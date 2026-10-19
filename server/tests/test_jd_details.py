import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.cleaning.jd_input import parse_sku_inputs
from app.config import Settings
from app.integrations.jd.client import DETAIL_METHOD, JDClient, JDError, JDPage, parse_response
from app.main import create_app


def detail(sku='100180790616', price='2999.90'):
    return {'skuId': sku, 'skuName': '<b>硬件品牌</b> 显卡 完整型号',
            'brandName': '硬件品牌', 'unitPrice': price}


def response_body(items, code=200):
    return json.dumps({DETAIL_METHOD.replace('.', '_') + '_responce': {
        'code': '0', 'queryResult': json.dumps({'code': code, 'data': items})}})


class InputTests(unittest.TestCase):
    def test_urls_skus_and_duplicate_inputs(self):
        inputs = ('https://item.jd.com/100180790616.html?pcdk=tracking&spmTag=tag\n'
                  '100180790616，https://item.m.jd.com/product/123.html;'
                  'https://item.m.jd.com/ware/view.action?wareId=456')
        self.assertEqual(parse_sku_inputs(inputs), ['100180790616', '123', '456'])

    def test_reject_ambiguous_or_external_input(self):
        for inputs in ['', '0', 'RTX 5080', 'https://item.jd.com.evil.com/123.html',
                       'https://u.jd.com/abc', 'https://item.jd.com@evil.com/123.html',
                       'https://user@item.jd.com/123.html', 'https://item.jd.com:999/123.html',
                       'https://item.jd.com/no-sku.html', ','.join(str(i) for i in range(1, 12))]:
            with self.subTest(inputs=inputs), self.assertRaises(ValueError):
                parse_sku_inputs(inputs)


class DetailClientTests(unittest.TestCase):
    def test_details_request_uses_csv_without_keyword_or_scene(self):
        with patch('app.integrations.jd.client.httpx.Client') as factory:
            transport = factory.return_value.__enter__.return_value
            transport.post.return_value = httpx.Response(200, text=response_body([detail()]),
                request=httpx.Request('POST', 'https://api.jd.com/routerjson'))
            client = JDClient(Settings(Path('unused'), 'test-key', 'test-secret'))
            self.assertEqual(client.details(['100180790616', '123']).items[0]['unitPrice'], '2999.90')
            params = transport.post.call_args.kwargs['data']
            self.assertEqual(params['method'], DETAIL_METHOD)
            self.assertEqual(json.loads(params['360buy_param_json']), {'skuIds': '100180790616,123'})

    def test_permission_and_gateway_errors_are_visible(self):
        for body, code in [(response_body([], 403), '403'),
                           ('{"error_response":{"code":"67","zh_desc":"upstream"}}', '67')]:
            with self.subTest(code=code), self.assertRaises(JDError) as error:
                parse_response(body, DETAIL_METHOD)
            self.assertEqual(error.exception.code, code)


class DetailFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.context = TestClient(create_app(Settings(Path(self.temp.name) / 'test.sqlite3', 'key', 'secret')))
        self.client = self.context.__enter__()
        self.patch = patch.object(self.client.app.state.jd_client, 'details')
        self.mock = self.patch.start()
        self.database = self.client.app.state.database

    def tearDown(self):
        self.patch.stop()
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def query(self, items, inputs='https://item.jd.com/100180790616.html\n123\n456'):
        self.mock.return_value = JDPage(items, len(items), response_body(items))
        response = self.client.post('/api/jd/details', json={'inputs': inputs, 'collectionKey': 'gpu-asus'})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_detail_cleaning_cache_missing_items_and_history(self):
        items = [detail(), detail('123', None), detail('999'), detail()]
        result = self.query(items)
        self.assertEqual(result['skuIds'], ['100180790616', '123', '456'])
        self.assertEqual(result['notReturnedSkuIds'], ['456'])
        self.assertEqual((result['validCount'], result['excludedCount'], result['duplicateCount']), (1, 3, 1))
        self.assertEqual(result['items'][0]['price'], 2999.9)
        self.assertEqual(result['items'][0]['name'], '硬件品牌 显卡 完整型号')
        self.assertEqual(result['method'], DETAIL_METHOD)
        self.assertFalse(result['hasMore'])
        cached = self.client.get('/api/jd/details', params={'collectionKey': 'gpu-asus'}).json()
        self.assertEqual(cached, result)
        self.assertIsNone(self.client.get('/api/jd/details', params={'collectionKey': 'cpu-amd'}).json())
        self.assertEqual(self.mock.call_count, 1)
        self.query([detail(price='3099')])
        old = self.client.get('/api/jd/tasks/' + result['taskId']).json()
        self.assertEqual(old['items'][0]['price'], 2999.9)
        with self.database.connect() as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM products').fetchone()[0], 1)
            self.assertIsNone(connection.execute('SELECT hardware_id FROM products').fetchone()[0])
            raw = connection.execute('SELECT payload_json FROM raw_records ORDER BY id LIMIT 1').fetchone()[0]
            self.assertIn('unitPrice', json.loads(json.loads(raw)[DETAIL_METHOD.replace('.', '_') + '_responce']['queryResult'])['data'][0])

    def test_input_validation_and_failed_task_keeps_previous_cache(self):
        saved = self.query([detail()])
        for inputs in ['', 'https://evil.com/123.html', 'not-a-sku']:
            response = self.client.post('/api/jd/details', json={'inputs': inputs, 'collectionKey': 'gpu-asus'})
            self.assertEqual(response.status_code, 422)
        self.mock.side_effect = JDError('详情权限不足', code='403')
        response = self.client.post('/api/jd/details', json={'inputs': '123', 'collectionKey': 'gpu-asus'})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()['detail']['code'], '403')
        self.assertEqual(self.client.get('/api/jd/details', params={'collectionKey': 'gpu-asus'}).json(), saved)
        with self.database.connect() as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM ingestion_tasks WHERE status='failed'").fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main()
