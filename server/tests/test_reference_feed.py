import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
import httpx
from app.repositories.database import Database
from app.ingestion.reference_feed import refresh_references
from app.ingestion.candidate_discovery import find_reference_candidates


class ReferenceFeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.temp.name) / 'test.db')
        self.db.initialize()

    def tearDown(self):
        self.temp.cleanup()

    def feed(self, category, html):
        return refresh_references(self.db, category, force=True,
            transport=httpx.MockTransport(lambda request: httpx.Response(200, text=html)))

    def test_whole_category_rows_persist_with_sources_and_bad_prices_rejected(self):
        html = '''更新于 2026-10-24 <h2>华硕<span>20款</span></h2><table>
        <tr><th>型号</th><th>报价</th></tr>
        <tr><td><a href="/p/test.html">RTX6070 Ti 16GB</a></td><td>¥8,000</td></tr>
        <tr><td>RTX6080 16GB</td><td>面议</td></tr>
        <tr><td>RTX6090</td><td>NaN</td></tr></table>'''
        self.assertEqual(self.feed('gpu', html)['rows'], 1)
        with self.db.connect() as db:
            row = db.execute('SELECT * FROM public_reference_records').fetchone()
            self.assertEqual(row['brand'], '华硕')
            self.assertEqual(row['price_cents'], 800000)
            self.assertEqual(row['source_url'], 'https://baojia.xinde8.com/p/test.html')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM products').fetchone()[0], 0)
        selected = SimpleNamespace(category='gpu', brand='微星', modelName='RTX6070 Ti 16GB', specs='16GB')
        options = find_reference_candidates(SimpleNamespace(database=self.db), selected, [])
        self.assertEqual(len(options), 1)
        self.assertNotIn('marketOffer', options[0])
        self.assertEqual(options[0]['referencePrice']['amount'], options[0]['price'])
        self.assertEqual(self.feed('gpu', '<html>Blocked</html>')['status'], 'empty_source')
        self.assertEqual(len(find_reference_candidates(SimpleNamespace(database=self.db), selected, [])), 1)

    def test_intel_rows_expand_without_per_model_registry(self):
        self.feed('cpu', '<h2>Intel 14代<span>2款</span></h2><tr><td>I5-14600KF</td><td>¥1295</td></tr>')
        selected = SimpleNamespace(category='cpu', brand='Intel', modelName='Intel Core i5-14600K', specs='LGA1700')
        options = find_reference_candidates(SimpleNamespace(database=self.db), selected, [])
        self.assertEqual(len(options), 1)
        self.assertEqual(options[0]['price'], 1295)
        self.assertIn('Core i5-14600KF', options[0]['name'])

    def test_two_single_modules_are_explicit_arithmetic_estimate_not_factory_kit(self):
        self.feed('ram', '<h2>海盗船<span>1款</span></h2><tr><td>海盗船 DDR5 32G 6000Hz C36</td><td>¥500</td></tr>')
        selected = SimpleNamespace(category='ram', brand='金士顿', modelName='DDR5 6000 64GB', specs='32GBx2')
        options = find_reference_candidates(SimpleNamespace(database=self.db), selected, [])
        self.assertEqual(len(options), 1)
        self.assertEqual(options[0]['price'], 1000)
        self.assertEqual(options[0]['referencePrice']['basis'], 'estimated')
        self.assertIn('不是原厂双条套装', options[0]['referencePrice']['note'])
