import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

SCHEMA = Path(__file__).resolve().parents[1] / "models" / "schema.sql"


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.executescript(SCHEMA.read_text(encoding="utf-8"))
            columns = {row['name'] for row in connection.execute('PRAGMA table_info(taobao_searches)')}
            if 'tmall_only' not in columns:
                connection.execute('ALTER TABLE taobao_searches ADD COLUMN tmall_only INTEGER NOT NULL DEFAULT 0')

    def list_hardware(self):
        with self.connect() as connection:
            rows = connection.execute("SELECT * FROM hardware ORDER BY category_id, brand, model").fetchall()
        return [dict(id=row["id"], categoryId=row["category_id"], brand=row["brand"],
                     model=row["model"], name=row["name"],
                     specifications=json.loads(row["specifications_json"])) for row in rows]

    def hardware_exists(self, hardware_id: str):
        with self.connect() as connection:
            return connection.execute("SELECT 1 FROM hardware WHERE id = ?", (hardware_id,)).fetchone() is not None

    def list_offers(self, hardware_id: str):
        # Choose the latest listed snapshot for each product, then discard missing prices.
        # An invalid latest price must not silently fall back to an older valid price.
        with self.connect() as connection:
            rows = connection.execute("""
                WITH ranked AS (
                    SELECT *, ROW_NUMBER() OVER (
                        PARTITION BY product_id ORDER BY collected_at DESC, id DESC
                    ) AS position FROM price_snapshots WHERE price_type = 'listed'
                )
                SELECT p.*, s.price_cents, s.collected_at
                FROM products p JOIN ranked s ON s.product_id = p.id
                WHERE p.hardware_id = ? AND s.position = 1 AND s.price_cents IS NOT NULL
                ORDER BY s.price_cents, p.id
            """, (hardware_id,)).fetchall()
        return [dict(id=row["id"], hardwareId=row["hardware_id"], platform=row["platform"],
                     productId=row["platform_product_id"], shop=row["shop"],
                     price=row["price_cents"] / 100, currency="CNY", priceType="listed",
                     productUrl=row["product_url"], collectedAt=row["collected_at"], source="api") for row in rows]
