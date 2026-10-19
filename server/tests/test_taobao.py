import hashlib
import json
import unittest
from pathlib import Path
from urllib.parse import parse_qs
import httpx
from app.config import Settings
from app.integrations.taobao import TaobaoClient, TaobaoError, parse_item, sign, clean_item


class TaobaoTests(unittest.TestCase):
    def test_url_preserves_sku_and_source(self):
        url = 'https://detail.tmall.com/item.htm?id=769696180391&skuId=6142881693379&mi_id=abc'
        result = parse_item(url)
        self.assertEqual(result['itemId'], '769696180391')
        self.assertEqual(result['skuId'], '6142881693379')
        self.assertEqual(result['sourceUrl'], url)
        for bad in ['https://evil.com/?id=1', 'https://detail.tmall.com.evil.com/?id=1',
                    'https://u:p@detail.tmall.com/?id=1', 'https://detail.tmall.com/?id=1&id=2']:
            with self.assertRaises(ValueError):
                parse_item(bad)

    def test_sign_sorted_and_utf8(self):
        expected = hashlib.md5('secretbar2foo1secret'.encode()).hexdigest().upper()
        self.assertEqual(sign({'foo': '1', 'bar': '2', 'sign': 'ignored'}, 'secret'), expected)
        self.assertEqual(sign({'a': '中文'}, 's'), hashlib.md5('sa中文s'.encode()).hexdigest().upper())

    def test_new_id_preserved_not_numeric_sku(self):
        self.assertEqual(parse_item('opaque_new-item_123')['itemId'], 'opaque_new-item_123')
        settings = Settings(Path('unused'), taobao_app_key='key', taobao_app_secret='secret')
        with self.assertRaises(ValueError):
            TaobaoClient(settings).details(['opaque_new-item_123'], '2')

    def test_form_request_and_response(self):
        settings = Settings(Path('unused'), taobao_app_key='key', taobao_app_secret='secret')
        def handler(request):
            self.assertEqual(str(request.url), 'https://eco.taobao.com/router/rest')
            values = {key: value[0] for key, value in parse_qs(request.content.decode()).items()}
            self.assertEqual(values['num_iids'], '769696180391')
            self.assertEqual(values['biz_scene_id'], '2')
            self.assertNotIn('skuId', values)
            self.assertEqual(values['sign'], sign(values, 'secret'))
            return httpx.Response(200, json={'tbk_item_info_get_response': {'results': {'n_tbk_item': [{'num_iid': '769696180391'}]}}})
        result = TaobaoClient(settings, httpx.MockTransport(handler)).details(['769696180391'])
        self.assertEqual(len(result), 1)
        self.assertNotIn('secret', repr(settings))

    def test_error_does_not_echo_secrets_or_request(self):
        settings = Settings(Path('unused'), taobao_app_key='key', taobao_app_secret='secret')
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json={'error_response': {'code': 15, 'msg': 'secret'}}))
        with self.assertRaises(TaobaoError) as error:
            TaobaoClient(settings, transport).details(['1'])
        self.assertNotIn('secret', str(error.exception))

    def test_distinct_price_bases_and_item_not_sku(self):
        item = clean_item({'num_iid': '1', 'title': '<b>内存</b>', 'reserve_price': '100.00',
                           'zk_final_price': '90.00', 'sale_price': '80', 'presale_deposit': '10'})
        self.assertEqual(item['reservePriceCents'], 10000)
        self.assertEqual(item['discountPriceCents'], 9000)
        self.assertEqual(item['activityPriceCents'], 8000)
        self.assertFalse(item['skuVerified'])
        self.assertTrue(item['presale'])
        for value in ['NaN', 'Infinity', '-1', '0', '0.001', None]:
            result = clean_item({'num_iid': '1', 'title': '配件', 'zk_final_price': value, 'sale_price': '50'})
            self.assertIsNone(result['discountPriceCents'])
