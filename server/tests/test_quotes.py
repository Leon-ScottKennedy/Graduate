import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings

TARGET = dict(category='gpu', brand='MSI', modelName='RTX 4070 SUPER VENTUS 2X OC', specs='12GB GDDR6X')


class QuoteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.client = TestClient(create_app(Settings(Path(self.temp.name) / 'quotes.sqlite')))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def quote(self, **changes):
        return dict(platform='jd', shop='测试店铺', productUrl='https://item.jd.com/123.html?tracking=one',
                    price='4000.10', shipping='10.00', observedAt=datetime.now(timezone.utc).isoformat(), note='', **changes)

    def save(self, quotes, target=TARGET):
        return self.client.post('/api/quotes/import', json=dict(target=target, confirmed=True, quotes=quotes))

    def compare(self, target=TARGET):
        return self.client.post('/api/quotes/compare', json=target).json()

    def test_model_isolation_shop_comparison_history_and_idempotency(self):
        quote = self.quote()
        self.assertEqual(self.save([quote]).status_code, 200)
        self.save([quote])
        result = self.compare()
        self.assertEqual(result['lowest'], 4010.1)
        self.assertEqual(len(self.client.get('/api/quotes/' + result['offers'][0]['id'] + '/history').json()), 1)
        second = {**quote, 'platform': 'taobao', 'shop': '另一家店', 'price': '3900', 'productUrl': 'https://detail.tmall.com/item.htm?id=789&skuId=111&spm=test'}
        self.save([second])
        result = self.compare()
        self.assertEqual(result['shopCount'], 2)
        self.assertEqual(result['offers'][1]['difference'], 100.1)
        self.assertNotIn('spm', result['offers'][0]['productUrl'])
        self.assertEqual(self.compare({**TARGET, 'specs': '16GB GDDR6X'})['offers'], [])
        updated = {**quote, 'price': '3800', 'observedAt': (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()}
        self.save([updated])
        result = self.compare()
        self.assertEqual(result['lowest'], 3810)
        quote_id = result['offers'][0]['id']
        self.assertEqual(len(self.client.get('/api/quotes/' + quote_id + '/history').json()), 2)
        self.client.delete('/api/quotes/' + quote_id)
        self.assertEqual(len(self.compare()['offers']), 1)

    def test_validation_atomic_batch_and_stale(self):
        for change in [dict(productUrl='https://evil.example/item'), dict(price='nan'), dict(price='1.001'),
                       dict(observedAt='2026-01-01T12:00:00'), dict(observedAt='2099-01-01T00:00:00Z')]:
            self.assertEqual(self.save([{**self.quote(), **change}]).status_code, 422)
        self.assertEqual(self.save([self.quote(), {**self.quote(), 'price': '-1'}]).status_code, 422)
        self.assertEqual(self.compare()['offers'], [])
        self.assertEqual(self.client.post('/api/quotes/import', json=dict(target=TARGET, confirmed=False, quotes=[self.quote()])).status_code, 422)
        stale = {**self.quote(), 'observedAt': (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()}
        self.save([stale])
        self.assertTrue(self.compare()['offers'][0]['stale'])
        self.assertIsNone(self.compare()['lowest'])
        self.assertEqual(self.compare()['shopCount'], 0)

    def test_csv_atomic_import_and_latest_observation_not_insertion(self):
        import csv, io
        quote = self.quote()
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(quote))
        writer.writeheader(); writer.writerow(quote)
        response = self.client.post('/api/quotes/import-csv', json=dict(target=TARGET, confirmed=True, csv=buffer.getvalue()))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.compare()['offers'][0]['source'], 'csv')
        old = {**quote, 'price': '100', 'observedAt': (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}
        self.save([old])
        self.assertEqual(self.compare()['lowest'], 4010.1)
        writer.writerow({**quote, 'price': 'invalid'})
        self.assertEqual(self.client.post('/api/quotes/import-csv', json=dict(target=TARGET, confirmed=True, csv=buffer.getvalue())).status_code, 422)
        self.assertEqual(len(self.client.get('/api/quotes/' + self.compare()['offers'][0]['id'] + '/history').json()), 2)
