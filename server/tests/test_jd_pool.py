import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.cleaning.jd_goods import clean_good
from app.cleaning.jd_categories import hardware_category
from app.ingestion.jd_pool import JDPoolService, _collection_lock
from app.integrations.jd.client import JDPage, JDError


def item(identity='opaque_ABC-123', price='2199.90', category='显卡', title='华硕 RTX 4060 显卡'):
    return dict(itemId=identity, skuName=title, brandName='华硕',
                categoryInfo={'cid1': 670, 'cid2Name': '电脑组件', 'cid3Name': category},
                shopInfo={'shopName': '测试旗舰店'}, priceInfo={'price': price, 'lowestCouponPrice': 1},
                materialUrl=f'jingfen.jd.com/detail/{identity}.html')


def page(items, total=None):
    return JDPage(items, len(items) if total is None else total, json.dumps({'data': items}))


class PoolCleaningTests(unittest.TestCase):
    def test_opaque_identity_material_url_and_displayed_price(self):
        result = clean_good(item(), 'itemId').good
        self.assertEqual(result.sku, 'opaque_ABC-123')
        self.assertEqual(result.product_url, 'https://jingfen.jd.com/detail/opaque_ABC-123.html')
        self.assertEqual(result.price_cents, 219990)
        for url in ['', 'javascript:alert(1)', 'https://jingfen.jd.com.evil/a', 'https://user@jingfen.jd.com/a']:
            value = item()
            value['materialUrl'] = url
            self.assertIsNone(clean_good(value, 'itemId').good)

    def test_category_is_not_inferred_from_title(self):
        self.assertEqual(hardware_category(item()), 'gpu')
        garbage = item(category='智能垃圾处理器', title='垃圾处理器 CPU 智能电源')
        garbage['categoryInfo']['cid2Name'] = '厨房卫浴'
        self.assertIsNone(hardware_category(garbage))
        self.assertIsNone(hardware_category({'skuName': 'RTX 5090 显卡'}))
        charger = item(category='电源')
        charger['categoryInfo']['cid2Name'] = '手机配件'
        self.assertIsNone(hardware_category(charger))


class PoolFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.context = TestClient(create_app(Settings(Path(self.temp.name) / 'test.sqlite3', 'key', 'secret')))
        self.api = self.context.__enter__()
        self.database = self.api.app.state.database
        self.client = SimpleNamespace(configured=True, pool=Mock(), item_details=Mock(return_value=page([])))
        self.api.app.state.jd_client = self.client
        self.service = JDPoolService(self.database, self.client)

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def test_clean_persist_enrich_history_and_api(self):
        self.client.pool.return_value = page([item(), item(), item('bad-price', None), item('other', category='鼠标')])
        self.client.item_details.return_value = page([
            {'itemId': 'opaque_ABC-123', 'skuName': '详情标题', 'baseBigFieldInfo': {'wdis': '<p>详情</p>'}},
            {'itemId': 'not-requested', 'skuName': '不属于本次请求'},
        ])
        run = self.service.collect()
        self.assertEqual((run['receivedCount'], run['validCount'], run['excludedCount'], run['duplicateCount'], run['detailCount']), (4, 1, 3, 1, 1))
        catalog = self.api.get('/api/jd/catalog?category=gpu').json()
        product = catalog['items'][0]
        self.assertEqual(product['itemId'], 'opaque_ABC-123')
        self.assertEqual(product['price'], 2199.9)  # Detail has no price and must not overwrite it.
        self.assertEqual(product['name'], '华硕 RTX 4060 显卡')
        self.assertTrue(product['detailsCollectedAt'])
        self.assertEqual(catalog['coverage'][1]['count'], 1)
        self.assertEqual(self.api.get('/api/jd/catalog?category=cpu').json()['items'], [])
        self.assertEqual(self.api.get('/api/jd/catalog?category=gpu&q=no-match').json()['totalCount'], 0)
        self.assertEqual(self.api.get('/api/jd/catalog?category=unknown').status_code, 422)
        self.assertEqual(self.api.get('/api/jd/catalog/missing/history').status_code, 404)
        with self.database.connect() as connection:
            self.assertIsNone(connection.execute('SELECT hardware_id FROM products').fetchone()[0])
            self.assertEqual(connection.execute('SELECT count(*) FROM jd_item_details').fetchone()[0], 1)
            self.assertEqual(connection.execute('SELECT count(*) FROM raw_records').fetchone()[0], 8)
            self.assertGreater(connection.execute('SELECT count(*) FROM cleaning_events').fetchone()[0], 0)
        self.client.pool.return_value = page([item(price='2299.50')])
        self.service.collect(enrich_limit=0)
        history = self.api.get('/api/jd/catalog/' + product['id'] + '/history').json()
        self.assertEqual([point['price'] for point in history], [2299.5, 2199.9])
        self.client.pool.return_value = page([item(price=None)])
        self.service.collect(enrich_limit=0)
        self.assertEqual(self.service.catalog('gpu')['items'], [])
        self.assertIsNone(self.service.history(product['id'])[0]['price'])
        with self.database.connect() as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM products').fetchone()[0], 1)

    def test_partial_failure_retains_completed_page(self):
        self.client.pool.side_effect = [page([item(f'item-{index}', title=f'华硕 显卡 型号{index}') for index in range(50)], 100), JDError('timeout', 504)]
        with self.assertRaises(JDError):
            self.service.collect(2)
        catalog = self.service.catalog('gpu')
        self.assertEqual(catalog['totalCount'], 50)
        self.assertEqual(catalog['latestRun']['status'], 'failed')
        self.assertEqual(catalog['latestRun']['pages'], 1)
        self.assertTrue(catalog['hasMore'])
        self.assertEqual(len(self.service.catalog('gpu', page=3)['items']), 10)
        self.client.item_details.assert_not_called()

    def test_optional_detail_failure_does_not_lose_quotes(self):
        self.client.pool.return_value = page([item()])
        self.client.item_details.side_effect = JDError('permission', code='403')
        result = self.api.post('/api/jd/pool/collect', json={'pages': 1})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['detailFailed'], 1)
        self.assertEqual(self.service.catalog('gpu')['items'][0]['price'], 2199.9)
        self.assertIsNone(self.service.catalog('gpu')['items'][0]['detailsCollectedAt'])

    def test_empty_input_and_collection_lock(self):
        self.assertEqual(self.api.post('/api/jd/pool/collect', json={'pages': 31}).status_code, 422)
        _collection_lock.acquire()
        try:
            self.assertEqual(self.api.post('/api/jd/pool/collect', json={'pages': 1}).status_code, 409)
        finally:
            _collection_lock.release()
        self.client.pool.return_value = page([])
        run = self.service.collect()
        self.assertEqual(run['validCount'], 0)
        self.assertEqual(self.service.catalog('cpu')['totalCount'], 0)
        self.client.item_details.assert_not_called()


    def test_collection_resumes_and_reaches_later_categories(self):
        self.client.pool.side_effect = [
            page([item(f'gpu-{index}') for index in range(50)], 120),
            page([item(f'ram-{index}', category='内存', title=f'DDR5 内存 型号{index}') for index in range(50)], 120),
            page([item('cpu-late', category='CPU', title='AMD CPU')], 120),
        ]
        self.service.collect(1, enrich_limit=0)
        self.assertEqual(self.service.catalog('ram')['scan']['nextPage'], 2)
        self.assertEqual(self.service.catalog('ram')['totalCount'], 0)
        self.service.collect(1, enrich_limit=0)
        self.assertEqual(self.service.catalog('ram')['totalCount'], 50)
        self.assertEqual(self.service.catalog('ram')['scan']['nextPage'], 3)
        self.service.collect(1, enrich_limit=0)
        progress = self.service.catalog('cpu')['scan']
        self.assertEqual((progress['scannedPages'], progress['totalPages'], progress['nextPage']), (3, 3, 1))
        self.assertIsNotNone(progress['fullScanAt'])
        self.assertEqual([call.args[1] for call in self.client.pool.call_args_list], [1, 2, 3])
        self.assertEqual(self.service.catalog('cpu')['totalCount'], 1)

    def test_failed_page_keeps_cursor_and_restart_is_explicit(self):
        self.client.pool.return_value = page([item(f'gpu-{index}') for index in range(50)], 200)
        self.service.collect(1, enrich_limit=0)
        self.client.pool.side_effect = JDError('timeout', 504)
        with self.assertRaises(JDError):
            self.service.collect(1, enrich_limit=0)
        self.assertEqual(self.service.catalog('gpu')['scan']['nextPage'], 2)
        self.client.pool.side_effect = None
        self.service.collect(1, enrich_limit=0)
        self.assertEqual(self.client.pool.call_args.args[1], 2)
        self.service.collect(1, enrich_limit=0, restart=True)
        self.assertEqual(self.client.pool.call_args.args[1], 1)


if __name__ == '__main__':
    unittest.main()
