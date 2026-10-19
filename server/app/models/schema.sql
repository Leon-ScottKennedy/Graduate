-- Monetary values use integer CNY cents; missing prices remain NULL.
CREATE TABLE IF NOT EXISTS quote_models (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    model_name TEXT NOT NULL,
    specs TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manual_quotes (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL REFERENCES quote_models(id),
    platform TEXT NOT NULL CHECK(platform IN ('jd','taobao')),
    shop TEXT NOT NULL,
    product_url TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS manual_quote_prices (
    id INTEGER PRIMARY KEY,
    quote_id TEXT NOT NULL REFERENCES manual_quotes(id),
    price_cents INTEGER NOT NULL CHECK(price_cents > 0),
    shipping_cents INTEGER NOT NULL CHECK(shipping_cents >= 0),
    observed_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    note TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('manual','csv'))
);
CREATE INDEX IF NOT EXISTS idx_manual_price ON manual_quote_prices(quote_id, observed_at, id);
CREATE TABLE IF NOT EXISTS taobao_searches (
    task_id TEXT PRIMARY KEY REFERENCES ingestion_tasks(id),
    keyword TEXT NOT NULL,
    page INTEGER NOT NULL,
    page_size INTEGER NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    received_count INTEGER NOT NULL DEFAULT 0,
    valid_count INTEGER NOT NULL DEFAULT 0,
    excluded_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);
CREATE TABLE IF NOT EXISTS taobao_search_results (
    task_id TEXT NOT NULL REFERENCES ingestion_tasks(id),
    position INTEGER NOT NULL,
    product_id TEXT REFERENCES products(id),
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id),
    payload_json TEXT NOT NULL,
    PRIMARY KEY(task_id, position)
);
CREATE INDEX IF NOT EXISTS idx_taobao_search ON taobao_searches(keyword,page,page_size);
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

-- Additive tables: keep old installations/data intact.
CREATE TABLE IF NOT EXISTS jd_searches (
    task_id TEXT PRIMARY KEY REFERENCES ingestion_tasks(id),
    keyword TEXT NOT NULL,
    page INTEGER NOT NULL,
    page_size INTEGER NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    received_count INTEGER NOT NULL DEFAULT 0,
    valid_count INTEGER NOT NULL DEFAULT 0,
    excluded_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_jd_search_keyword ON jd_searches(keyword, page, page_size);
CREATE TABLE IF NOT EXISTS product_details (
    product_id TEXT PRIMARY KEY REFERENCES products(id),
    title TEXT NOT NULL,
    brand TEXT NOT NULL,
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id)
);
CREATE TABLE IF NOT EXISTS jd_search_results (
    task_id TEXT NOT NULL REFERENCES ingestion_tasks(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    snapshot_id INTEGER NOT NULL REFERENCES price_snapshots(id),
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id),
    title TEXT NOT NULL,
    brand TEXT NOT NULL,
    shop TEXT NOT NULL,
    PRIMARY KEY(task_id, product_id)
);

CREATE TABLE IF NOT EXISTS jd_detail_queries (
    task_id TEXT PRIMARY KEY REFERENCES ingestion_tasks(id),
    collection_key TEXT NOT NULL,
    sku_ids_json TEXT NOT NULL,
    not_returned_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_jd_detail_collection ON jd_detail_queries(collection_key);

CREATE TABLE IF NOT EXISTS jd_pool_runs (
    task_id TEXT PRIMARY KEY REFERENCES ingestion_tasks(id),
    elite_id INTEGER NOT NULL,
    page_limit INTEGER NOT NULL,
    pages_completed INTEGER NOT NULL DEFAULT 0,
    received_count INTEGER NOT NULL DEFAULT 0,
    valid_count INTEGER NOT NULL DEFAULT 0,
    excluded_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    detail_count INTEGER NOT NULL DEFAULT 0,
    detail_failed INTEGER NOT NULL DEFAULT 0,
    error_code TEXT
);
CREATE TABLE IF NOT EXISTS jd_pool_items (
    product_id TEXT PRIMARY KEY REFERENCES products(id),
    item_id TEXT NOT NULL UNIQUE,
    category_id TEXT NOT NULL,
    task_id TEXT NOT NULL REFERENCES ingestion_tasks(id),
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id),
    snapshot_id INTEGER REFERENCES price_snapshots(id),
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jd_pool_category ON jd_pool_items(category_id);
CREATE TABLE IF NOT EXISTS jd_item_details (
    product_id TEXT PRIMARY KEY REFERENCES products(id),
    raw_record_id INTEGER NOT NULL REFERENCES raw_records(id),
    payload_json TEXT NOT NULL,
    collected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jd_pool_progress (
    elite_id INTEGER PRIMARY KEY,
    next_page INTEGER NOT NULL DEFAULT 1,
    total_pages INTEGER NOT NULL DEFAULT 0,
    scanned_pages INTEGER NOT NULL DEFAULT 0,
    full_scan_at TEXT
);
CREATE TABLE IF NOT EXISTS jd_pool_run_progress (
    task_id TEXT PRIMARY KEY REFERENCES ingestion_tasks(id),
    start_page INTEGER NOT NULL,
    last_page INTEGER NOT NULL DEFAULT 0
);
