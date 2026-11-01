import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.cleaning.model_match import matches, capacities


class CatalogOffersTests(unittest.TestCase):
    def test_memory_and_ssd_title_attribute_order_is_not_model_identity(self):
        ram = dict(brand='海盗船', name='海盗船 复仇者 32GB DDR5 6000MHz 台式机内存')
        self.assertTrue(matches('ram', '海盗船 CORSAIR', '海盗船 VENGEANCE DDR5 6000 32GB', '16GB × 2 · DDR5 · 6000MT/s', ram))
        self.assertTrue(matches('ram', '海盗船 CORSAIR', '海盗船 VENGEANCE DDR5 6000 32GB', '16GB × 2 · DDR5 · 6000MT/s', {**ram, 'name': ram['name'] + ' (16GB×2)'}))
        self.assertFalse(matches('ram', '海盗船 CORSAIR', '海盗船 VENGEANCE DDR5 6000 32GB', '16GB × 2 · DDR5 · 6000MT/s', {**ram, 'name': ram['name'].replace('6000','5200')}))
        self.assertTrue(matches('ssd', '雷克沙 Lexar', '雷克沙 NM790 1TB', '1TB PCIe 4.0', dict(brand='雷克沙',name='雷克沙NM790电竞固态硬盘 PCIe4.0 1TB')))
        self.assertFalse(matches('ssd', '雷克沙 Lexar', '雷克沙 NM790 1TB', '1TB PCIe 4.0', dict(brand='雷克沙',name='雷克沙NM790电竞固态硬盘 PCIe4.0 2TB')))
    def test_asus_chinese_series_and_o8g_identity(self):
        name = '华硕 Dual GeForce RTX 5060 Ti OC 8GB'
        product = dict(brand='华硕', name='华硕 雪豹 GeForce RTX5060 Ti O8G')
        self.assertTrue(matches('gpu', '华硕 ASUS', name, '8GB GDDR7', product))
        self.assertFalse(matches('gpu', '华硕 ASUS', name, '8GB GDDR7', {**product, 'name': product['name'].replace('O8G','O16G')}))
    def test_colorful_brand_alias_does_not_hide_same_model(self):
        name = '七彩虹 战斧 GeForce RTX 4070 Ti SUPER 豪华版 16GB'
        self.assertTrue(matches('gpu', '七彩虹 Colorful', name, '16GB GDDR6X', dict(brand='七彩虹', name=name)))
        self.assertFalse(matches('gpu', '七彩虹 Colorful', name, '16GB GDDR6X', dict(brand='七彩虹', name=name.replace('4070 Ti SUPER', '4070 SUPER').replace('16GB', '12GB'))))

    def test_gpu_memory_position_and_marketing_suffix(self):
        product = dict(brand='影驰', name='影驰GeForce RTX 5060 Ti 圣刃 OC 8GB GDDR7 DLSS 游戏显卡')
        self.assertTrue(matches('gpu', '影驰 GALAX', '影驰 GeForce RTX 5060 Ti 圣刃 OC 8GB', '8GB GDDR7', product))
        self.assertTrue(matches('gpu', '影驰 GALAX', '影驰 GeForce RTX 5060 Ti 圣刃 OC 8GB', '8GB', {**product, 'name': product['name'].replace('8GB GDDR7', '8GBGDDR7')}))
        self.assertFalse(matches('gpu', '影驰 GALAX', '影驰 GeForce RTX 5060 Ti 圣刃 OC 16GB', '16GB', product))
        self.assertFalse(matches('gpu', '影驰 GALAX', '影驰 GeForce RTX 5060 圣刃 OC 8GB', '8GB', product))
        self.assertFalse(matches('gpu', '影驰 GALAX', '影驰 GeForce RTX 5060 Ti 魔刃 OC 8GB', '8GB', product))

    def test_mixed_capacities_are_not_a_single_sku(self):
        self.assertEqual(capacities('2tb 4t 1t'), {2048, 4096, 1024})
        self.assertFalse(matches('ssd','三星 Samsung','三星 990 PRO 2TB','2TB',dict(brand='三星',name='三星990pro固态硬盘2tb台式4t内置1t高速ssd')))

    def test_batch_returns_only_recent_matching_offers_and_links(self):
        with tempfile.TemporaryDirectory() as folder, TestClient(create_app(Settings(Path(folder)/'test.db'))) as api:
            with api.app.state.database.connect() as db:
                db.execute("INSERT INTO ingestion_tasks VALUES('t','jd','completed',datetime('now'),NULL)")
                raw = db.execute("INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES('t',datetime('now'),?)", ('{"owner":"g"}',)).lastrowid
                db.execute("INSERT INTO products(id,platform,platform_product_id,shop,product_url) VALUES('p','jd','123','测试自营','https://item.jd.com/123.html')")
                db.execute("INSERT INTO product_details VALUES('p',?,'影驰',?)", ('影驰GeForce RTX 5060 Ti 圣刃 OC 8GB GDDR7 DLSS',raw))
                db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,price_type,collected_at) VALUES('p','t',?,399900,'listed',datetime('now'))", (raw,))
            model = dict(id='new-gpu',category='gpu',brand='影驰 GALAX',modelName='影驰 GeForce RTX 5060 Ti 圣刃 OC 8GB',specs='8GB')
            data = api.post('/api/market/catalog-offers',json=dict(models=[model])).json()
            self.assertEqual(data['offers'][0]['modelId'],'new-gpu')
            self.assertEqual(data['offers'][0]['price'],3999)
            self.assertEqual(data['offers'][0]['productUrl'],'https://item.jd.com/123.html')
            with api.app.state.database.connect() as db:
                db.execute("UPDATE price_snapshots SET collected_at='2020-01-01'")
            self.assertEqual(api.post('/api/market/catalog-offers',json=dict(models=[model])).json()['offers'],[])
