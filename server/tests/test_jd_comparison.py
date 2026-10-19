import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.cleaning.model_match import matches
from app.cleaning.jd_categories import hardware_category
from app.ingestion.jd_pool import JDPoolService
from app.ingestion.jd_comparison import JDComparisonService
from app.integrations.jd.client import JDPage

NAME = '利民 Peerless Assassin 120 SE'
TITLE = '利民(Thermalright)Peerless Assassin 120 SE 逆重力6热管 风冷散热器 双塔'


def item(identity, shop_id=1, price='137.87', title=TITLE):
    return dict(itemId=identity, skuName=title, brandName='利民(Thermalright)',
                shopInfo={'shopId': shop_id, 'shopName': f'店铺{shop_id}'},
                categoryInfo={'cid2Name': '电脑组件', 'cid3Name': '散热器'},
                priceInfo={'price': price}, materialUrl=f'jingfen.jd.com/detail/{identity}.html')


class MatchingTests(unittest.TestCase):
    def test_cooler_full_model_brand_and_version(self):
        source = {'brand': '利民(Thermalright)', 'name': TITLE}
        self.assertTrue(matches('cooler', '利民 Thermalright', NAME, '双塔风冷', source))
        for title in [TITLE.replace('120 SE', '120 SE V2'), TITLE.replace('120 SE', '120'),
                      TITLE + ' ARGB', TITLE + ' 白色', TITLE + ' 二手', TITLE + ' 套餐']:
            self.assertFalse(matches('cooler', '利民 Thermalright', NAME, '双塔风冷', {**source, 'name': title}))
        self.assertFalse(matches('cooler', '九州风神', NAME, '', source))

    def test_memory_generation_capacity_frequency_and_ambiguous_options(self):
        name = '金士顿 FURY Beast DDR5 6000 32GB'
        source = {'brand': 'Kingston', 'name': '金士顿 FURY Beast DDR5 6000 32GB 台式机内存'}
        self.assertTrue(matches('ram', '金士顿 Kingston', name, 'DDR5 6000MT/s', source))
        for title in [source['name'].replace('DDR5', 'DDR4'), source['name'].replace('32GB', '64GB'),
                      source['name'].replace('6000', '5600'), source['name'] + ' 64GB 可选']:
            self.assertFalse(matches('ram', '金士顿 Kingston', name, 'DDR5 6000MT/s', {**source, 'name': title}))

    def test_cpu_suffix_gpu_vram_storage_capacity(self):
        self.assertTrue(matches('cpu', 'AMD', 'AMD Ryzen 5 7500F', '', {'brand': 'AMD', 'name': 'AMD 锐龙5 7500F 处理器'}))
        self.assertFalse(matches('cpu', 'AMD', 'AMD Ryzen 5 7500F', '', {'brand': 'AMD', 'name': 'AMD 7500 处理器'}))
        self.assertFalse(matches('cpu', 'AMD', 'AMD Ryzen 5 7500F', '', {'brand': 'AMD', 'name': 'AMD 7500F 7600 可选'}))
        name = '微星 RTX 4070 SUPER VENTUS 2X OC'
        self.assertTrue(matches('gpu', '微星 MSI', name, '12GB', {'brand': 'MSI', 'name': name + ' 12GB'}))
        self.assertFalse(matches('gpu', '微星 MSI', name, '12GB', {'brand': 'MSI', 'name': name + ' 16GB'}))
        self.assertFalse(matches('ssd', '三星', '三星 980 PRO 2TB', '2TB', {'brand': '三星', 'name': '三星 980 PRO 1TB'}))

    def test_accessories_are_not_cpu_coolers(self):
        for title in ['利民 TF7 4g导热硅脂 CPU散热膏', 'Tt钢影时空360 机箱风扇 三联排', '散热器安装支架']:
            self.assertIsNone(hardware_category(item('accessory', title=title)))
        self.assertEqual(hardware_category(item('cooler')), 'cooler')


class ComparisonFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.context = TestClient(create_app(Settings(Path(self.temp.name) / 'test.sqlite3', 'key', 'secret')))
        self.api = self.context.__enter__()
        self.db = self.api.app.state.database
        self.fake = SimpleNamespace(configured=True, pool=Mock(), item_details=Mock())
        self.pool = JDPoolService(self.db, self.fake)
        self.service = JDComparisonService(self.db)
        self.target = dict(category='cooler', brand='利民 Thermalright', modelName=NAME, specs='双塔风冷')

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def collect(self, items):
        self.fake.pool.return_value = JDPage(items, len(items), json.dumps({'data': items}))
        self.pool.collect(1, enrich_limit=0)

    def compare(self):
        response = self.api.post('/api/jd/compare', json=self.target)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_multi_shop_prices_and_same_shop_duplicate_records(self):
        self.collect([item('a', 1, '140'), item('b', 2, '160'), item('other-version', 3, '99', TITLE + ' ARGB')])
        first = self.compare()
        self.assertEqual(first['shopCount'], 2)
        self.assertEqual([offer['difference'] for offer in first['offers']], [0, 20])
        first_id = first['offers'][0]['id']
        self.collect([item('rotated-a', 1, '150')])
        result = self.compare()
        self.assertEqual(result['shopCount'], 2)
        self.assertEqual(result['offers'][0]['price'], 150)  # Latest, not old cheaper quote.
        self.assertEqual(result['offers'][0]['id'], first_id)
        self.assertEqual(result['offers'][0]['mergedCount'], 2)
        self.assertEqual(result['offers'][1]['difference'], 10)
        history = self.api.post('/api/jd/compare/history', json={**self.target, 'offerId': first_id}).json()
        self.assertEqual([row['price'] for row in history], [150, 140])
        self.assertEqual(self.pool.catalog('cooler')['totalCount'], 3)  # Two shops plus different ARGB model.
        with self.db.connect() as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM products').fetchone()[0], 4)

    def test_single_shop_no_lowest_claim_and_latest_null_suppresses_alias(self):
        self.collect([item('a')])
        result = self.compare()
        self.assertEqual(result['shopCount'], 1)
        self.assertIsNone(result['offers'][0]['difference'])
        self.assertFalse(result['offers'][0]['isLowest'])
        self.collect([item('rotated')])
        self.collect([item('rotated', price=None)])
        self.assertEqual(self.compare()['shopCount'], 0)
        self.assertEqual(self.pool.catalog('cooler')['totalCount'], 0)

    def test_empty_or_wrong_model_unknown_shop_and_history_validation(self):
        self.collect([item('a')])
        unknown = item('unknown-shop')
        unknown['shopInfo'] = {}
        self.collect([unknown])
        self.assertEqual(self.compare()['shopCount'], 1)
        self.assertEqual(self.api.post('/api/jd/compare', json={**self.target, 'modelName': '利民 AK120'}).json()['shopCount'], 0)
        self.assertEqual(self.api.post('/api/jd/compare', json={**self.target, 'category': 'unknown'}).status_code, 422)
        self.assertEqual(self.api.post('/api/jd/compare/history', json={**self.target, 'offerId': 'unknown'}).status_code, 404)
        self.assertEqual(self.api.post('/api/jd/compare', json={**self.target, 'key': 'not-accepted'}).status_code, 422)

    def test_changed_listing_version_does_not_mix_old_price_history(self):
        self.collect([item('same-id', price='140')])
        self.collect([item('same-id', price='160', title=TITLE + ' ARGB')])
        target = {**self.target, 'modelName': NAME + ' ARGB'}
        result = self.api.post('/api/jd/compare', json=target).json()
        self.assertEqual(result['shopCount'], 1)
        history = self.api.post('/api/jd/compare/history', json={**target, 'offerId': result['offers'][0]['id']}).json()
        self.assertEqual([row['price'] for row in history], [160])


if __name__ == '__main__':
    unittest.main()
