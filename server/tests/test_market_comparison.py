import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from unittest.mock import patch
from app.ingestion.market_comparison import allowed_gpu, merchant_profile, market_keyword
from urllib.parse import urlsplit, parse_qs


class MarketComparisonTests(unittest.TestCase):
    def test_local_browsing_is_available_during_remote_failure_cooldown(self):
        with tempfile.TemporaryDirectory() as directory, TestClient(create_app(Settings(Path(directory) / 'test.db'))) as api:
            with api.app.state.database.connect() as db:
                db.execute("INSERT INTO ingestion_tasks VALUES('failed','taobao','failed',datetime('now'),datetime('now'))")
            with patch.object(api.app.state.taobao_search, 'search', side_effect=AssertionError('Must not query platform')):
                for category, brand, name in [('gpu','微星 MSI','微星 RTX 4080 SUPER'), ('cpu','AMD','AMD Ryzen 7 7700')]:
                    response = api.post('/api/market/compare', json=dict(category=category, brand=brand, modelName=name, specs=''))
                    self.assertEqual(response.status_code, 200)

    def test_model_search_removes_edition_and_provides_real_search_destinations(self):
        self.assertEqual(market_keyword('gpu', '微星 MSI', '微星 RTX 4080 SUPER VENTUS 3X OC', '16GB'), '微星 RTX 4080 SUPER')
        self.assertEqual(market_keyword('gpu', '华硕 ASUS', '华硕 RTX 4070 Ti SUPER O16G', '16GB'), '华硕 RTX 4070 Ti SUPER')
        with tempfile.TemporaryDirectory() as directory, TestClient(create_app(Settings(Path(directory) / 'test.db'))) as api:
            data = api.post('/api/market/compare', json=dict(category='gpu', brand='微星 MSI', modelName='微星 RTX 4080 SUPER VENTUS 3X OC', specs='16GB')).json()
            self.assertEqual(data['total'], 0)
            self.assertEqual(data['searchKeyword'], '微星 RTX 4080 SUPER')
            jd, tmall = data['storeSearches']
            self.assertEqual(urlsplit(jd['url']).hostname, 'search.jd.com')
            self.assertEqual(parse_qs(urlsplit(jd['url']).query)['keyword'], ['微星 RTX 4080 SUPER'])
            self.assertEqual(urlsplit(tmall['url']).hostname, 'list.tmall.com')

    def test_merchant_priority_uses_platform_metadata(self):
        self.assertEqual(merchant_profile('jd', '普通店名', {'owner': 'g'}), (0, '京东自营'))
        self.assertEqual(merchant_profile('jd', '京东自营旗舰店', {'owner': 'p'}), (2, '京东'))
        self.assertEqual(merchant_profile('taobao', '华硕官方旗舰店', {'item_basic_info': {'user_type': 1}}), (0, '天猫'))
        self.assertEqual(merchant_profile('taobao', '华硕专卖店', {'item_basic_info': {'user_type': 1}}), (0, '天猫'))
        self.assertEqual(merchant_profile('taobao', '华硕官方旗舰店', {'item_basic_info': {'user_type': 0}}), (1, '淘宝'))
        self.assertEqual(merchant_profile('taobao', '电脑小店', {}), (3, '淘宝'))

    def test_gpu_vendor_and_condition_filter(self):
        for title, brand in [('PNY 必恩威 RTX4070 Super 无拆无修', 'PNY'),
                             ('PNY RTX4070 Super', 'ASUS'),
                             ('某品牌 RTX4070 SUPER', ''),
                             ('华硕 RTX4070 SUPER 二手', 'ASUS'),
                             ('微星 RTX4070 SUPER 无拆无修', 'MSI'),
                             ('华硕 RTX4070 SUPER 水冷头', 'ASUS')]:
            self.assertFalse(allowed_gpu(title, brand))
        for title, brand in [('华硕 RTX4070 SUPER', ''), ('MSI RTX4070 SUPER', 'MSI'),
                             ('蓝宝石 RX 7800 XT', 'Sapphire')]:
            self.assertTrue(allowed_gpu(title, brand))

    def test_candidate_gpu_editions_share_persisted_chip_data_offline(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = Settings(Path(directory) / 'test.db')
            with TestClient(create_app(settings)) as api:
                with api.app.state.database.connect() as db:
                    db.execute("INSERT INTO ingestion_tasks VALUES('task','taobao','completed','2026-10-20',NULL)")
                    for index, title in enumerate([
                        '微星 RTX 4070 SUPER VENTUS 2X OC 12GB',
                        '华硕 Dual RTX4070SUPER O12G 12GB',
                        '微星 RTX 4070 Ti SUPER 16GB',
                        '华硕 RTX 4070 12GB',
                        '技嘉 RTX 4070 SUPER 12GB',
                        'PNY 必恩威 RTX4070 Super 无拆无修',
                        '未知品牌 RTX4070 Super',
                        '华硕 RTX4070 SUPER 二手',
                    ]):
                        raw = db.execute("INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES('task','2026-10-20','{}')").lastrowid
                        db.execute('INSERT INTO products(id,platform,platform_product_id,shop) VALUES(?,?,?,?)', (str(index), 'taobao', str(index), '华硕官方旗舰店' if index == 1 else '店铺'))
                        if index == 1:
                            db.execute('UPDATE raw_records SET payload_json=? WHERE id=?', ('{"item_basic_info":{"user_type":1}}', raw))
                        db.execute('INSERT INTO product_details VALUES(?,?,?,?)', (str(index), title, ('MSI' if index == 0 else 'ASUS') if index < 5 else '', raw))
                        db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,collected_at,price_type) VALUES(?,'task',?,400000,'2026-10-20','listed')", (str(index), raw))
            # Reopen the application to verify persisted data, without any platform request.
            with TestClient(create_app(settings)) as api, patch('app.integrations.taobao.TaobaoClient.search') as remote:
                for brand, name in [('微星 MSI', '微星 RTX 4070 SUPER VENTUS 2X OC'),
                                    ('华硕 ASUS', '华硕 Dual RTX 4070 SUPER O12G')]:
                    response = api.post('/api/market/compare', json=dict(category='gpu', brand=brand, modelName=name, specs='RTX 4070 SUPER · 12GB GDDR6X'))
                    self.assertEqual(response.status_code, 200)
                    rows = response.json()['products']
                    self.assertEqual({row['id'] for row in rows}, {'0', '1', '4'})
                    self.assertEqual(rows[0]['id'], '1')
                    self.assertEqual(rows[0]['platformLabel'], '天猫')
                    self.assertTrue(any(row['matchStatus'] == 'reference' and '同芯片' in row['relationLabel'] for row in rows))
                remote.assert_not_called()

    def test_cross_platform_latest_snapshot_and_model_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            with TestClient(create_app(Settings(Path(directory) / 'test.db'))) as api:
                with api.app.state.database.connect() as db:
                    db.execute("INSERT INTO ingestion_tasks VALUES('task','jd','completed','2026-10-20T00:00:00+00:00',NULL)")
                    for index, (platform, title, price) in enumerate([
                        ('jd', 'AMD Ryzen 5 7500F', 99900),
                        ('taobao', 'AMD Ryzen 5 7500F', 89900),
                        ('taobao', 'AMD Ryzen 7 7700', 150000),
                        ('taobao', '7500F 二手处理器', 50000),
                        ('taobao', '7500F 风冷散热器', 10000),
                    ]):
                        raw = db.execute("INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES('task','2026-10-20','{}')").lastrowid
                        db.execute('INSERT INTO products(id,platform,platform_product_id,shop) VALUES(?,?,?,?)', (str(index), platform, str(index), '同名店铺'))
                        db.execute('INSERT INTO product_details VALUES(?,?,?,?)', (str(index), title, 'AMD', raw))
                        if index == 4:
                            db.execute('UPDATE raw_records SET payload_json=? WHERE id=?', ('{"item_basic_info":{"category_name":"散热器"}}', raw))
                        db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,collected_at,price_type) VALUES(?,'task',?,?,?,'listed')", (str(index), raw, price, '2026-10-20T00:00:00+00:00'))
                    db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,collected_at,price_type) VALUES('1','task',2,NULL,'2026-10-20T01:00:00+00:00','listed')")
                target = dict(category='cpu', brand='AMD', modelName='AMD Ryzen 5 7500F', specs='AM5')
                result = api.post('/api/market/compare', json=target).json()
                self.assertEqual(result['counts'], dict(jd=1, taobao=2))
                self.assertEqual(result['total'], 3)
                by_id = {row['id']: row for row in result['products']}
                self.assertIsNone(by_id['1']['price'])
                self.assertEqual(by_id['3']['matchStatus'], 'reference')
                self.assertEqual(by_id['0']['matchStatus'], 'title_match')
                filtered = api.post('/api/market/compare', json={**target, 'platform': 'jd'}).json()
                self.assertEqual(filtered['total'], 1)
                self.assertEqual(api.post('/api/market/compare', json={**target, 'platform': 'bad'}).status_code, 422)
