-- Monetary values use integer CNY cents; missing prices remain NULL.
CREATE TABLE IF NOT EXISTS ingestion_tasks (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('jd', 'taobao')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TEXT NOT NULL,
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS raw_records (
    id INTEGER PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES ingestion_tasks(id),
    captured_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hardware (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    name TEXT NOT NULL,
    specifications_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(category_id, brand, model)
);
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    hardware_id TEXT REFERENCES hardware(id),
    platform TEXT NOT NULL CHECK (platform IN ('jd', 'taobao')),
    platform_product_id TEXT NOT NULL,
    shop TEXT NOT NULL,
    product_url TEXT,
    UNIQUE(platform, platform_product_id)
);
CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    task_id TEXT NOT NULL REFERENCES ingestion_tasks(id),
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id),
    price_cents INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
    currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
    price_type TEXT NOT NULL CHECK (price_type IN ('listed', 'coupon', 'deposit')),
    collected_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prices_product_time ON price_snapshots(product_id, collected_at);
CREATE TABLE IF NOT EXISTS cleaning_events (
    id INTEGER PRIMARY KEY,
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id),
    rule TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('normalized', 'excluded', 'review')),
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
);
