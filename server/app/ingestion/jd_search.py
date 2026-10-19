import json
from datetime import datetime, timezone
from uuid import uuid4

from ..cleaning.jd_goods import clean_good, clean_text, detail_fields
from ..integrations.jd.client import JDClient, JDError, DETAIL_METHOD
from ..repositories.database import Database


def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')


class JDSearchService:
    def __init__(self, database: Database, client: JDClient):
        self.database, self.client = database, client

    def search(self, keyword: str, page: int, page_size: int):
        return self._collect(keyword, page, page_size, lambda: self.client.search(keyword, page, page_size))

    def details(self, sku_ids: list[str], collection_key: str):
        return self._collect(','.join(sku_ids), 1, len(sku_ids),
                             lambda: self.client.details(sku_ids), sku_ids, collection_key)

    def _collect(self, keyword, page, page_size, fetch, sku_ids=None, collection_key=None):
        if not self.client.configured:
            raise JDError('请先在 server/.env 填写 JD_APP_KEY 和 JD_APP_SECRET。', 503)
        task_id, started = uuid4().hex, now()
        with self.database.connect() as connection:
            connection.execute('INSERT INTO ingestion_tasks VALUES (?, ?, ?, ?, NULL)', (task_id, 'jd', 'running', started))
            connection.execute('INSERT INTO jd_searches(task_id, keyword, page, page_size) VALUES (?, ?, ?, ?)', (task_id, keyword, page, page_size))
            if sku_ids is not None:
                connection.execute('INSERT INTO jd_detail_queries(task_id, collection_key, sku_ids_json) VALUES (?, ?, ?)',
                                   (task_id, collection_key, json.dumps(sku_ids)))
        try:
            result = fetch()
            captured = now()
            # Commit the original business response before cleaning, preserving evidence on failure.
            with self.database.connect() as connection:
                connection.execute('INSERT INTO raw_records(task_id, captured_at, payload_json) VALUES (?, ?, ?)', (task_id, captured, result.raw_response))
            seen, returned, valid, excluded, duplicates = set(), set(), 0, 0, 0
            with self.database.connect() as connection:
                for item in result.items:
                    raw_id = connection.execute('INSERT INTO raw_records(task_id, captured_at, payload_json) VALUES (?, ?, ?)', (task_id, captured, json.dumps(item, ensure_ascii=False))).lastrowid
                    fields = detail_fields(item) if sku_ids is not None else item
                    item_sku = clean_text(fields.get('skuId'))
                    cleaned = clean_good(fields)
                    events = cleaned.events
                    good = cleaned.good
                    if sku_ids is not None and item_sku not in sku_ids:
                        good = None
                        events = [('unexpected_sku', 'excluded', '接口返回了本次未请求的商品编号')]
                    elif sku_ids is not None:
                        returned.add(item_sku)
                    if item_sku in seen:
                        good = None
                        duplicates += 1
                        events = [('duplicate_sku', 'excluded', '同一次查询中商品 ID 重复')]
                    if not good:
                        excluded += 1
                        if any(rule == 'price' for rule, _, _ in events):
                            existing = connection.execute("SELECT id FROM products WHERE platform='jd' AND platform_product_id=?", (item_sku,)).fetchone()
                            if existing:
                                connection.execute("INSERT INTO price_snapshots(product_id, task_id, raw_record_id, price_cents, currency, price_type, collected_at) VALUES (?, ?, ?, NULL, 'CNY', 'listed', ?)", (existing['id'], task_id, raw_id, captured))
                    else:
                        seen.add(good.sku)
                        valid += 1
                        product_id = f'jd:{good.sku}'
                        # Unconfirmed search hits remain unrelated to standard hardware.
                        connection.execute('''INSERT INTO products(id, hardware_id, platform, platform_product_id, shop, product_url)
                            VALUES (?, NULL, 'jd', ?, ?, ?) ON CONFLICT(platform, platform_product_id)
                            DO UPDATE SET shop = excluded.shop, product_url = excluded.product_url''', (product_id, good.sku, good.shop, good.product_url))
                        product_id = connection.execute("SELECT id FROM products WHERE platform='jd' AND platform_product_id=?", (good.sku,)).fetchone()['id']
                        connection.execute('''INSERT INTO product_details VALUES (?, ?, ?, ?)
                            ON CONFLICT(product_id) DO UPDATE SET title=excluded.title, brand=excluded.brand, raw_record_id=excluded.raw_record_id''', (product_id, good.title, good.brand, raw_id))
                        snapshot_id = connection.execute('''INSERT INTO price_snapshots(product_id, task_id, raw_record_id, price_cents, currency, price_type, collected_at)
                            VALUES (?, ?, ?, ?, 'CNY', 'listed', ?)''', (product_id, task_id, raw_id, good.price_cents, captured)).lastrowid
                        connection.execute('INSERT INTO jd_search_results VALUES (?, ?, ?, ?, ?, ?, ?)', (task_id, product_id, snapshot_id, raw_id, good.title, good.brand, good.shop))
                    for rule, action, reason in events:
                        connection.execute('INSERT INTO cleaning_events(raw_record_id, rule, action, reason, created_at) VALUES (?, ?, ?, ?, ?)', (raw_id, rule, action, reason, captured))
                connection.execute('''UPDATE jd_searches SET total_count=?, received_count=?, valid_count=?, excluded_count=?, duplicate_count=? WHERE task_id=?''', (result.total_count, len(result.items), valid, excluded, duplicates, task_id))
                connection.execute("UPDATE ingestion_tasks SET status='completed', finished_at=? WHERE id=?", (now(), task_id))
                if sku_ids is not None:
                    connection.execute('UPDATE jd_detail_queries SET not_returned_json=? WHERE task_id=?',
                                       (json.dumps([sku for sku in sku_ids if sku not in returned]), task_id))
        except Exception as exc:
            with self.database.connect() as connection:
                connection.execute("UPDATE ingestion_tasks SET status='failed', finished_at=? WHERE id=?", (now(), task_id))
                connection.execute('UPDATE jd_searches SET error_code=? WHERE task_id=?', (exc.code if isinstance(exc, JDError) else 'processing_error', task_id))
            if isinstance(exc, JDError):
                raise
            raise JDError('商品数据处理失败，原始响应已保留，请检查后端。', 500) from exc
        return self.get(task_id)

    def get(self, task_id: str):
        with self.database.connect() as connection:
            task = connection.execute('SELECT s.*, t.status, t.started_at, t.finished_at FROM jd_searches s JOIN ingestion_tasks t ON t.id=s.task_id WHERE s.task_id=?', (task_id,)).fetchone()
            if not task:
                return None
            rows = connection.execute('''SELECT r.*, p.platform_product_id, p.product_url, s.price_cents, s.collected_at
                FROM jd_search_results r JOIN products p ON p.id=r.product_id
                JOIN price_snapshots s ON s.id=r.snapshot_id WHERE r.task_id=? ORDER BY s.price_cents, r.product_id''', (task_id,)).fetchall()
            detail = connection.execute('SELECT * FROM jd_detail_queries WHERE task_id=?', (task_id,)).fetchone()
        result = {
            'taskId': task_id, 'keyword': task['keyword'], 'page': task['page'], 'pageSize': task['page_size'],
            'status': task['status'], 'collectedAt': task['finished_at'] or task['started_at'],
            'totalCount': task['total_count'], 'receivedCount': task['received_count'],
            'validCount': task['valid_count'], 'excludedCount': task['excluded_count'], 'duplicateCount': task['duplicate_count'],
            'hasMore': task['page'] * task['page_size'] < task['total_count'],
            'items': [dict(id=row['product_id'], productId=row['platform_product_id'], name=row['title'], brand=row['brand'],
                          shop=row['shop'] or '店铺未提供', price=row['price_cents'] / 100,
                          productUrl=row['product_url'], collectedAt=row['collected_at'],
                          platform='jd', priceType='listed', matchStatus='unverified') for row in rows],
        }
        if detail:
            result.update(method=DETAIL_METHOD, collectionKey=detail['collection_key'],
                          skuIds=json.loads(detail['sku_ids_json']), notReturnedSkuIds=json.loads(detail['not_returned_json']), hasMore=False)
        return result

    def cached_details(self, collection_key: str):
        with self.database.connect() as connection:
            row = connection.execute('''SELECT q.task_id FROM jd_detail_queries q
                JOIN ingestion_tasks t ON t.id=q.task_id WHERE q.collection_key=? AND t.status='completed'
                ORDER BY t.started_at DESC LIMIT 1''', (collection_key,)).fetchone()
        return self.get(row['task_id']) if row else None

    def cached(self, keyword: str, page: int, page_size: int):
        with self.database.connect() as connection:
            row = connection.execute('''SELECT s.task_id FROM jd_searches s JOIN ingestion_tasks t ON t.id=s.task_id
                WHERE s.keyword=? AND s.page=? AND s.page_size=? AND t.status='completed'
                ORDER BY t.started_at DESC LIMIT 1''', (keyword, page, page_size)).fetchone()
        return self.get(row['task_id']) if row else None
