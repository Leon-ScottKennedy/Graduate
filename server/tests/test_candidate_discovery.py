import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.ingestion.candidate_discovery import profile, compatible, keyword


class CandidateDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.api = TestClient(create_app(Settings(Path(self.temp.name) / 'test.db')))
        self.api.__enter__()
        self.feed = patch('app.ingestion.candidate_discovery.refresh_references', return_value=dict(status='cached', rows=0))
        self.feed.start()
        self.selected = dict(id='selected', category='gpu', brand='微星 MSI',
                             modelName='微星 RTX 6070 Ti 16GB', specs='16GB GDDR7')

    def tearDown(self):
        self.feed.stop()
        self.api.__exit__(None, None, None)
        self.temp.cleanup()

    def insert(self, identifier, title, brand='华硕', category='显卡', price=800000, days=0, platform='jd', raw=None):
        now = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        raw = raw or dict(owner='g', categoryInfo=dict(cid2Name='电脑组件', cid3Name=category))
        with self.api.app.state.database.connect() as db:
            db.execute("INSERT INTO ingestion_tasks VALUES(?,'jd','completed',?,NULL)", (identifier, now))
            record = db.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES(?,?,?)', (identifier, now, json.dumps(raw))).lastrowid
            url = 'https://item.jd.com/' + identifier + '.html' if platform == 'jd' else 'https://detail.tmall.com/item.htm?id=' + identifier
            db.execute('INSERT INTO products(id,platform,platform_product_id,shop,product_url) VALUES(?,?,?,?,?)', (identifier, platform, identifier, '测试店铺', url))
            db.execute('INSERT INTO product_details VALUES(?,?,?,?)', (identifier, title, brand, record))
            db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,price_type,collected_at) VALUES(?,?,?,?,'listed',?)", (identifier, identifier, record, price, now))

    def lookup(self, collect=False, catalog=None):
        response = self.api.post('/api/market/alternatives/discover', json=dict(selected=self.selected, catalog=catalog or [], collect=collect))
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_unregistered_future_chip_across_brands_without_ai(self):
        # Synthetic future names prove discovery is not keyed to the curated 50-series list.
        self.insert('one', '华硕 PRIME RTX6070 Ti OC 16GB')
        self.insert('two', '技嘉 RTX 6070 Ti GAMING OC 16GB', '技嘉')
        with patch.object(self.api.app.state.ai_service, 'review', side_effect=AssertionError('No AI')):
            result = self.lookup()
        self.assertEqual(len(result['options']), 2)
        self.assertEqual({item['brand'] for item in result['options']}, {'华硕', '技嘉'})
        self.assertTrue(all(item['price'] == 8000 and item['marketOffer']['productUrl'] for item in result['options']))
        self.assertTrue(all('gpuLengthMm' not in item.get('compatibility', {}) for item in result['options']))
        self.assertEqual([item['id'] for item in result['options']], [item['id'] for item in self.lookup()['options']])
        chosen = result['options'][0]
        self.selected = dict(id=chosen['id'], category='gpu', brand=chosen['brand'],
                             modelName=chosen['name'], specs=chosen['specs'])
        after_replacement = self.lookup()['options']
        self.assertTrue(after_replacement)
        self.assertTrue(all(item['brand'] != chosen['brand'] for item in after_replacement))

    def test_rejects_ambiguous_capacity_chip_used_accessory_and_wrong_category(self):
        for index, title in enumerate(['华硕 RTX 6070 Ti 8GB', '华硕 RTX 6070 16GB',
                                      '华硕 RTX 6070 Ti 8GB/16GB', '华硕 RTX 6070 Ti 16GB 二手',
                                      '华硕 RTX 6070 Ti 16GB 支架', '华硕 RTX 6070 Ti/6080 16GB',
                                      '华硕 技嘉 RTX 6070 Ti 16GB']):
            self.insert(str(index), title)
        self.insert('wrong', '华硕 RTX 6070 Ti 16GB', category='机箱')
        self.assertEqual(self.lookup()['options'], [])

    def test_stale_null_and_invalid_latest_prices_never_resurrected(self):
        self.insert('old', '华硕 RTX 6070 Ti 16GB', days=8)
        self.insert('null', '技嘉 RTX 6070 Ti 16GB', '技嘉', price=None)
        self.insert('last', '影驰 RTX 6070 Ti 16GB', '影驰')
        with self.api.app.state.database.connect() as db:
            db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,price_type,collected_at) SELECT product_id,task_id,raw_record_id,NULL,'listed',collected_at FROM price_snapshots WHERE product_id='last'")
        self.assertEqual(self.lookup()['options'], [])

    def test_deduplicates_shops_and_excludes_registered_models(self):
        title = '华硕 PRIME RTX 6070 Ti OC 16GB'
        self.insert('a', title, price=850000)
        self.insert('b', title, price=800000)
        self.assertEqual(len(self.lookup()['options']), 1)
        self.assertEqual(self.lookup()['options'][0]['price'], 8000)
        self.assertEqual(self.lookup(catalog=[dict(self.selected, id='known', brand='华硕', modelName=title)])['options'], [])

    def test_same_spec_shares_collection_cooldown_across_models(self):
        self.api.app.state.jd_client = SimpleNamespace(configured=True)
        with patch('app.ingestion.candidate_discovery.JDSearchService.search') as search:
            self.lookup(True)
            self.selected.update(brand='七彩虹', modelName='七彩虹 RTX 6070 Ti 16GB')
            self.assertEqual(self.lookup(True)['collection'], 'cooldown')
            self.assertEqual(search.call_count, 1)
            self.assertNotIn('微星', search.call_args.args[0])
            self.assertIn('6070TI', search.call_args.args[0])

    def test_collection_results_are_read_back_from_database(self):
        self.api.app.state.jd_client = SimpleNamespace(configured=True)
        with patch('app.ingestion.candidate_discovery.JDSearchService.search', side_effect=lambda *args: self.insert('new', '华硕 RTX 6070 Ti 16GB')):
            self.assertEqual(len(self.lookup(True)['options']), 1)
        self.assertEqual(len(self.lookup()['options']), 1)

    def test_unconfigured_and_unknown_specs_are_explicit(self):
        self.assertEqual(self.lookup(True)['collection'], 'not_configured')
        self.selected.update(modelName='未知显卡', specs='容量未知')
        self.assertEqual(self.lookup(True)['collection'], 'insufficient_specs')

    def test_ram_total_capacity_and_kit_layout(self):
        self.selected = dict(self.selected, category='ram', brand='金士顿', modelName='金士顿 DDR5 6000 64GB', specs='32GB × 2 · DDR5 · 6000MT/s')
        self.insert('ram', '海盗船 DDR5 6000 32GBx2 内存', '海盗船', '内存')
        self.insert('wrong-ram', '芝奇 DDR5 6000 16GBx2 内存', '芝奇', '内存')
        result = self.lookup()['options']
        self.assertEqual(len(result), 1)
        self.assertIn('64GB', result[0]['name'])
        self.assertIn('32GB × 2', result[0]['specs'])

    def test_all_eight_categories_use_specification_profiles(self):
        fixtures = dict(gpu='RTX 7090 Ti 24GB', board='B950M AM5 DDR5 M-ATX',
                        ram='DDR5 6400 64GB 32GBx2', ssd='2TB M.2 NVMe PCIe 5.0',
                        cpu='AMD Ryzen 7 9700X AM5', power='1000W 金牌电源',
                        case='M-ATX 机箱', cooler='双塔风冷散热器')
        for category, text in fixtures.items():
            with self.subTest(category=category):
                key = profile(category, text)
                self.assertIsNotNone(key)
                self.assertTrue(compatible(category, key, key))
                self.assertTrue(keyword(category, key))
        self.assertFalse(compatible('ram', profile('ram', fixtures['ram']), profile('ram', 'DDR5 4800 64GB 32GBx2')))
        self.assertFalse(compatible('ssd', profile('ssd', fixtures['ssd']), profile('ssd', '2TB M.2 NVMe PCIe 4.0')))

    def test_repeated_gpu_tokens_normalize_spacing_before_identity_check(self):
        self.assertEqual(profile('gpu', '华硕 Dual RTX 4060 O8G DUAL-RTX4060-O8G 8GB GDDR6'), ('RTX4060', 8))
        self.assertIsNone(profile('gpu', 'RTX 4060 RTX 4070 8GB'))

    def test_unknown_frequency_does_not_block_ram_family_discovery(self):
        target = profile('ram', 'DDR5 64GB 32GBx2')
        self.assertTrue(compatible('ram', target, profile('ram', 'DDR5 6000 64GB 32GBx2')))
        self.assertNotIn('None', keyword('ram', target))

    def test_intel_platform_and_class_supported_without_am5_assumption(self):
        target = profile('cpu', 'Intel Core i5-14600K LGA1700')
        self.assertIsNotNone(target)
        self.assertTrue(compatible('cpu', target, profile('cpu', 'Intel Core i5-14600KF')))
        self.assertFalse(compatible('cpu', target, profile('cpu', 'AMD Ryzen 5 9600X AM5')))

    def test_unknown_tower_count_is_not_invented_or_mixed_with_water_cooling(self):
        target = profile('cooler', '塔式风冷 · 120mm')
        self.assertEqual(target, ('风冷', '塔式'))
        self.assertTrue(compatible('cooler', target, profile('cooler', '双塔风冷')))
        self.assertFalse(compatible('cooler', target, profile('cooler', '360 水冷')))
