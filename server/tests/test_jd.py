import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.cleaning.jd_goods import clean_good
from app.config import Settings
from app.integrations.jd.client import JDClient, JDError, JDPage, parse_response, sign_parameters
from app.main import create_app


def goods(sku='1234567890123456789', price='2199.90', title='华硕 RTX 4060'):
    return dict(skuId=sku, skuName=title, brandName='华硕',
                shopInfo={'shopName': '品牌店'}, priceInfo={'price': price, 'lowestPrice': 1})


def envelope(items, code=200):
    return json.dumps({'jd_union_open_goods_query_responce': {
        'code': '0', 'queryResult': json.dumps({'code': code, 'data': items, 'totalCount': 40})}})


class ClientTests(unittest.TestCase):
    def test_signature_vector_and_order(self):
        # MD5("abc") is a public test vector. Empty parameters/sign must be ignored.
        self.assertEqual(sign_parameters({'a': 'bc', 'sign': 'unused', 'empty': ''}, ''),
                         '900150983CD24FB0D6963F7D28E17F72')
        self.assertEqual(sign_parameters({'a': 'b'}, 'c'), 'C37AEA192CD9086CACE3EBCA564EECCD')
        self.assertEqual(sign_parameters({'b': '2', 'a': '1'}, 'secret'),
                         sign_parameters({'a': '1', 'b': '2'}, 'secret'))

    def test_envelopes_and_failures(self):
        page = parse_response(envelope([goods()]))
        self.assertEqual(page.items[0]['skuId'], '1234567890123456789')
        self.assertEqual(page.total_count, 40)
        alternate = json.dumps({'jd_union_open_goods_query_response': {
            'queryResult': {'code': 200, 'data': [], 'totalCount': 0}}})
        self.assertEqual(parse_response(alternate).items, [])
        for body in ['{}', 'not json', '[]', envelope(''), envelope([None]), envelope([], 403),
                     '{"error_response":{"code":"19","zh_desc":"private details"}}']:
            with self.subTest(body=body), self.assertRaises(JDError) as error:
                parse_response(body)
            self.assertNotIn('private details', str(error.exception))

    def test_form_request_and_safe_network_error(self):
        settings = Settings(Path('unused'), 'private-key', 'private-secret')
        with patch('app.integrations.jd.client.httpx.Client') as factory:
            transport = factory.return_value.__enter__.return_value
            transport.post.return_value = httpx.Response(
                200, text=envelope([goods()]), request=httpx.Request('POST', 'https://api.jd.com/routerjson'))
            self.assertEqual(JDClient(settings).search('华硕 RTX', 2, 20).total_count, 40)
            args = transport.post.call_args
            self.assertEqual(args.args[0], 'https://api.jd.com/routerjson')
            params = args.kwargs['data']
            dto = json.loads(params['360buy_param_json'])['goodsReqDTO']
            self.assertEqual(dto, {'keyword': '华硕 RTX', 'pageIndex': 2, 'pageSize': 20})
            self.assertEqual(params['sign'], sign_parameters(params, settings.jd_app_secret))
            transport.post.side_effect = httpx.ReadTimeout('private-secret')
            with self.assertRaises(JDError) as error:
                JDClient(settings).search('RTX', 1, 20)
            self.assertEqual(error.exception.status, 504)
            self.assertNotIn('private-secret', str(error.exception))


class CleaningTests(unittest.TestCase):
    def test_text_money_and_identity(self):
        result = clean_good(goods(title=' <b>华硕</b>　RTX  4060 ', price='￥2,199.90'))
        self.assertEqual(result.good.title, '华硕 RTX 4060')
        self.assertEqual(result.good.price_cents, 219990)
        self.assertEqual(result.good.product_url, 'https://item.jd.com/1234567890123456789.html')
        self.assertIn(('title', 'normalized', '清除 HTML、全角字符或多余空白'), result.events)
        self.assertTrue(any(rule == 'model_match' for rule, _, _ in result.events))

    def test_invalid_prices_never_use_coupon_or_zero(self):
        for price in [None, '', ' ', 0, -1, True, 'NaN', 'Infinity', '1.001', 'invalid']:
            with self.subTest(price=price):
                result = clean_good(goods(price=price))
                self.assertIsNone(result.good)
                self.assertEqual(result.events[0][0], 'price')

    def test_required_fields_service_links_and_missing_brand(self):
        for item in [goods(sku=''), goods(sku=True), goods(title=' '), goods(title='RTX 4060 定金')]:
            self.assertIsNone(clean_good(item).good)
        item = goods()
        item.pop('brandName')
        item.pop('shopInfo')
        result = clean_good(item)
        self.assertEqual(result.good.brand, '')
        self.assertEqual({rule for rule, _, _ in result.events}, {'brand', 'shop', 'model_match'})


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name) / 'test.sqlite3', 'private-key', 'private-secret')
        self.context = TestClient(create_app(self.settings))
        self.client = self.context.__enter__()
        self.fake_patch = patch.object(self.client.app.state.jd_client, 'search')
        self.fake = self.fake_patch.start()
        self.database = self.client.app.state.database

    def tearDown(self):
        self.fake_patch.stop()
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def search(self, items):
        self.fake.return_value = JDPage(items, 40, envelope(items))
        response = self.client.post('/api/jd/search', json={'keyword': ' 华硕   RTX ', 'pageSize': 20})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_clean_persist_cache_and_history(self):
        result = self.search([goods(), goods(), goods(sku='2', price=None), goods(sku='3', title='定金')])
        self.assertEqual((result['receivedCount'], result['validCount'], result['excludedCount'], result['duplicateCount']), (4, 1, 3, 1))
        self.assertTrue(result['hasMore'])
        item = result['items'][0]
        self.assertEqual(item['productId'], '1234567890123456789')
        self.assertEqual(item['price'], 2199.9)
        self.assertEqual(item['matchStatus'], 'unverified')
        self.assertEqual(self.client.get('/api/jd/tasks/' + result['taskId']).json(), result)
        cached = self.client.get('/api/jd/search', params={'keyword': '华硕 RTX'}).json()
        self.assertEqual(cached, result)
        self.assertEqual(self.fake.call_count, 1)  # Reading cache must never trigger JD.
        later = self.search([goods(price='2200', title='更新标题')])
        self.assertEqual(later['items'][0]['price'], 2200)
        self.assertEqual(self.client.get('/api/jd/tasks/' + result['taskId']).json()['items'][0]['name'], '华硕 RTX 4060')
        with self.database.connect() as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM products').fetchone()[0], 1)
            self.assertEqual(connection.execute('SELECT count(*) FROM price_snapshots').fetchone()[0], 2)
            self.assertEqual(connection.execute('SELECT count(*) FROM raw_records').fetchone()[0], 7)
            self.assertIsNone(connection.execute('SELECT hardware_id FROM products').fetchone()[0])
            self.assertGreater(connection.execute('SELECT count(*) FROM cleaning_events').fetchone()[0], 0)

    def test_latest_invalid_price_invalidates_old_quote(self):
        self.search([goods()])
        with self.database.connect() as connection:
            connection.execute("INSERT INTO hardware VALUES ('gpu', 'gpu', 'ASUS', '4060', 'ASUS 4060', '{}')")
            connection.execute("UPDATE products SET hardware_id='gpu'")
        self.assertEqual(len(self.database.list_offers('gpu')), 1)
        self.search([goods(price=None)])
        self.assertEqual(self.database.list_offers('gpu'), [])

    def test_failure_validation_and_missing_configuration(self):
        self.fake.side_effect = JDError('京东拒绝请求', code='403')
        response = self.client.post('/api/jd/search', json={'keyword': 'RTX'})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('private-secret', response.text)
        with self.database.connect() as connection:
            self.assertEqual(connection.execute('SELECT status FROM ingestion_tasks').fetchone()[0], 'failed')
        for body in [{'keyword': '  '}, {'keyword': 'RTX', 'page': 0}, {'keyword': 'RTX', 'pageSize': 51}, {'keyword': 'RTX', 'secret': 'x'}]:
            self.assertEqual(self.client.post('/api/jd/search', json=body).status_code, 422)
        self.assertEqual(self.client.get('/api/jd/tasks/missing').status_code, 404)
        with TestClient(create_app(Settings(Path(self.temp.name) / 'empty.sqlite3', '', ''))) as empty:
            self.assertFalse(empty.get('/api/jd/status').json()['configured'])
            self.assertEqual(empty.post('/api/jd/search', json={'keyword': 'RTX'}).status_code, 503)
            with empty.app.state.database.connect() as connection:
                self.assertEqual(connection.execute('SELECT count(*) FROM ingestion_tasks').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
