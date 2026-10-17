import sqlite3
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.repositories.database import Database


class FoundationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name) / "test.sqlite3", "test-key", "test-secret")
        self.database = Database(self.settings.database_path)
        self.database.initialize()

    def tearDown(self):
        self.temp.cleanup()

    def seed(self):
        with self.database.connect() as connection:
            connection.execute("INSERT INTO ingestion_tasks VALUES ('t1', 'jd', 'completed', '2026-10-17T00:00:00Z', NULL)")
            connection.execute("INSERT INTO raw_records VALUES (1, 't1', '2026-10-17T00:00:00Z', '{}')")
            connection.execute("INSERT INTO hardware VALUES ('gpu1', 'gpu', 'Brand', 'Model', 'Brand Model', '{}')")
            connection.execute("INSERT INTO products VALUES ('p1', 'gpu1', 'jd', '123', 'Shop', NULL)")

    def test_empty_api_and_no_credentials_in_response(self):
        with TestClient(create_app(self.settings)) as client:
            self.assertEqual(client.get('/api/health').json(), {"status": "ok"})
            self.assertEqual(client.get('/api/hardware').json(), [])
            self.assertEqual(client.get('/api/hardware/missing/offers').status_code, 404)
            self.assertNotIn('test-secret', client.get('/openapi.json').text)
        self.assertNotIn('test-secret', repr(self.settings))

    def test_latest_missing_price_does_not_use_old_quote(self):
        self.seed()
        with self.database.connect() as connection:
            connection.execute("INSERT INTO price_snapshots VALUES (1, 'p1', 't1', 1, 219900, 'CNY', 'listed', '2026-10-17T01:00:00Z')")
            connection.execute("INSERT INTO price_snapshots VALUES (2, 'p1', 't1', 1, NULL, 'CNY', 'listed', '2026-10-17T02:00:00Z')")
        self.assertEqual(self.database.list_offers('gpu1'), [])

    def test_api_serialization_and_product_identity(self):
        self.seed()
        with self.database.connect() as connection:
            connection.execute("INSERT INTO price_snapshots VALUES (1, 'p1', 't1', 1, 219990, 'CNY', 'listed', '2026-10-17T01:00:00Z')")
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO products VALUES ('p2', 'gpu1', 'jd', '123', 'Other shop', NULL)")
        with TestClient(create_app(self.settings)) as client:
            hardware = client.get('/api/hardware').json()[0]
            self.assertEqual(hardware['categoryId'], 'gpu')
            quote = client.get('/api/hardware/gpu1/offers').json()[0]
            self.assertEqual(quote['price'], 2199.9)
            self.assertEqual(quote['hardwareId'], 'gpu1')
            self.assertEqual(quote['productId'], '123')


if __name__ == '__main__':
    unittest.main()
