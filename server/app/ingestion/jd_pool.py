import json
from threading import Lock
from uuid import uuid4

from ..cleaning.jd_categories import CATEGORIES, hardware_category
from ..cleaning.jd_goods import clean_good, clean_text
from ..integrations.jd.client import JDError
from .jd_search import now
from .jd_comparison import JDComparisonService

_collection_lock = Lock()


class JDPoolService:
    def __init__(self, database, client):
        self.database, self.client = database, client

    def collect(self, pages=3, enrich_limit=10, restart=False):
        if not self.client.configured:
            raise JDError('请先在 server/.env 填写京东应用密钥。', 503)
        if not 1 <= pages <= 30 or not 0 <= enrich_limit <= 20:
            raise JDError('采集页数或详情数量超出范围。', 422)
        if not _collection_lock.acquire(blocking=False):
            raise JDError('已有采集任务正在运行，请稍后查看。', 409)
        task_id = uuid4().hex
        counts = dict(received=0, valid=0, excluded=0, duplicates=0, pages=0, details=0, detail_failed=0)
        try:
            with self.database.connect() as connection:
                connection.execute("INSERT INTO ingestion_tasks VALUES (?, 'jd', 'running', ?, NULL)", (task_id, now()))
                connection.execute('INSERT INTO jd_pool_runs(task_id, elite_id, page_limit) VALUES (?, 24, ?)', (task_id, pages))
                connection.execute('INSERT OR IGNORE INTO jd_pool_progress(elite_id) VALUES (24)')
                progress = connection.execute('SELECT * FROM jd_pool_progress WHERE elite_id=24').fetchone()
                first_page = 1 if restart else progress['next_page']
                connection.execute('INSERT INTO jd_pool_run_progress(task_id,start_page) VALUES (?,?)', (task_id, first_page))
                if first_page == 1:
                    connection.execute('UPDATE jd_pool_progress SET scanned_pages=0 WHERE elite_id=24')
            seen, accepted = set(), []
            for page in range(first_page, first_page + pages):
                result = self.client.pool(24, page, 50)
                captured = now()
                # Separate commit preserves evidence if later processing fails.
                with self.database.connect() as connection:
                    connection.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES (?,?,?)', (task_id, captured, result.raw_response))
                with self.database.connect() as connection:
                    for item in result.items:
                        counts['received'] += 1
                        raw_id = connection.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES (?,?,?)', (task_id, captured, json.dumps(item, ensure_ascii=False))).lastrowid
                        item_id = clean_text(item.get('itemId'))
                        category = hardware_category(item)
                        cleaned = clean_good(item, 'itemId')
                        good, events = cleaned.good, cleaned.events
                        if item_id and item_id in seen:
                            good = None
                            counts['duplicates'] += 1
                            events = [('duplicate_item', 'excluded', '本次任务内 itemId 重复')]
                        elif not category:
                            good = None
                            events = [('hardware_category', 'excluded', '不在八类电脑组件范围或类目缺失')]
                        if item_id:
                            seen.add(item_id)
                        product_id = 'jd:item:' + item_id
                        if not good:
                            counts['excluded'] += 1
                            # Do not keep presenting a previous price when this product is now invalid.
                            existing = connection.execute('SELECT 1 FROM jd_pool_items WHERE product_id=?', (product_id,)).fetchone()
                            if existing and not any(rule == 'duplicate_item' for rule, _, _ in events):
                                connection.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,currency,price_type,collected_at) VALUES (?,?,?,NULL,'CNY','listed',?)", (product_id, task_id, raw_id, captured))
                                connection.execute('UPDATE jd_pool_items SET snapshot_id=NULL, task_id=?, raw_record_id=?, updated_at=? WHERE product_id=?', (task_id, raw_id, captured, product_id))
                        else:
                            counts['valid'] += 1
                            connection.execute('''INSERT INTO products VALUES (?,NULL,'jd',?,?,?)
                                ON CONFLICT(platform,platform_product_id) DO UPDATE SET shop=excluded.shop,product_url=excluded.product_url''',
                                (product_id, 'item:' + item_id, good.shop, good.product_url))
                            connection.execute('''INSERT INTO product_details VALUES (?,?,?,?) ON CONFLICT(product_id)
                                DO UPDATE SET title=excluded.title,brand=excluded.brand,raw_record_id=excluded.raw_record_id''', (product_id, good.title, good.brand, raw_id))
                            snapshot = connection.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,currency,price_type,collected_at) VALUES (?,?,?,?,'CNY','listed',?)", (product_id, task_id, raw_id, good.price_cents, captured)).lastrowid
                            connection.execute('''INSERT INTO jd_pool_items VALUES (?,?,?,?,?,?,?) ON CONFLICT(product_id)
                                DO UPDATE SET category_id=excluded.category_id,task_id=excluded.task_id,raw_record_id=excluded.raw_record_id,snapshot_id=excluded.snapshot_id,updated_at=excluded.updated_at''',
                                (product_id, item_id, category, task_id, raw_id, snapshot, captured))
                            accepted.append((product_id, item_id))
                        for rule, action, reason in events:
                            connection.execute('INSERT INTO cleaning_events(raw_record_id,rule,action,reason,created_at) VALUES (?,?,?,?,?)', (raw_id, rule, action, reason, captured))
                    counts['pages'] += 1
                    self._counts(connection, task_id, counts)
                    exhausted = len(result.items) < 50 or page * 50 >= result.total_count
                    total_pages = max(1, (result.total_count + 49) // 50)
                    connection.execute('''UPDATE jd_pool_progress SET next_page=?,total_pages=?,scanned_pages=?,
                        full_scan_at=CASE WHEN ? THEN ? ELSE full_scan_at END WHERE elite_id=24''',
                        (1 if exhausted else page + 1, total_pages, page, exhausted, captured))
                    connection.execute('UPDATE jd_pool_run_progress SET last_page=? WHERE task_id=?', (page, task_id))
                if len(result.items) < 50 or page * 50 >= result.total_count:
                    break
            for start in range(0, min(len(accepted), enrich_limit), 10):
                batch = dict((item_id, product_id) for product_id, item_id in accepted[start:min(start + 10, enrich_limit)])
                try:
                    details = self.client.item_details(list(batch))
                    captured = now()
                    with self.database.connect() as connection:
                        connection.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES (?,?,?)', (task_id, captured, details.raw_response))
                        enriched = set()
                        for item in details.items:
                            raw_id = connection.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES (?,?,?)', (task_id, captured, json.dumps(item, ensure_ascii=False))).lastrowid
                            item_id = clean_text(item.get('itemId'))
                            if item_id not in batch or item_id in enriched:
                                connection.execute("INSERT INTO cleaning_events(raw_record_id,rule,action,reason,created_at) VALUES (?,'detail_identity','excluded','详情编号未请求或重复',?)", (raw_id, captured))
                                continue
                            connection.execute('''INSERT INTO jd_item_details VALUES (?,?,?,?) ON CONFLICT(product_id)
                                DO UPDATE SET raw_record_id=excluded.raw_record_id,payload_json=excluded.payload_json,collected_at=excluded.collected_at''',
                                (batch[item_id], raw_id, json.dumps(item, ensure_ascii=False), captured))
                            enriched.add(item_id)
                        counts['details'] += len(enriched)
                        counts['detail_failed'] += len(batch) - len(enriched)
                except JDError:
                    # Detail enrichment is optional; successful price records stay usable.
                    counts['detail_failed'] += len(batch)
            with self.database.connect() as connection:
                self._counts(connection, task_id, counts)
                connection.execute("UPDATE ingestion_tasks SET status='completed',finished_at=? WHERE id=?", (now(), task_id))
            return self.run(task_id)
        except Exception as error:
            with self.database.connect() as connection:
                self._counts(connection, task_id, counts)
                connection.execute('UPDATE jd_pool_runs SET error_code=? WHERE task_id=?', (error.code if isinstance(error, JDError) else 'processing_error', task_id))
                connection.execute("UPDATE ingestion_tasks SET status='failed',finished_at=? WHERE id=?", (now(), task_id))
            if isinstance(error, JDError):
                raise
            raise JDError('京东数据处理失败，已采集的数据与原始记录保留。', 500) from error
        finally:
            _collection_lock.release()

    @staticmethod
    def _counts(connection, task_id, counts):
        connection.execute('''UPDATE jd_pool_runs SET pages_completed=?, received_count=?,valid_count=?,excluded_count=?,duplicate_count=?,detail_count=?,detail_failed=? WHERE task_id=?''',
                           (counts['pages'], counts['received'], counts['valid'], counts['excluded'], counts['duplicates'], counts['details'], counts['detail_failed'], task_id))

    def run(self, task_id=None):
        with self.database.connect() as connection:
            row = connection.execute('''SELECT r.*,t.status,t.started_at,t.finished_at FROM jd_pool_runs r JOIN ingestion_tasks t ON t.id=r.task_id
                WHERE (? IS NULL OR r.task_id=?) ORDER BY t.started_at DESC LIMIT 1''', (task_id, task_id)).fetchone()
        if not row:
            return None
        return dict(taskId=row['task_id'], status=row['status'], collectedAt=row['finished_at'] or row['started_at'],
                    pages=row['pages_completed'], receivedCount=row['received_count'], validCount=row['valid_count'],
                    excludedCount=row['excluded_count'], duplicateCount=row['duplicate_count'], detailCount=row['detail_count'],
                    detailFailed=row['detail_failed'], errorCode=row['error_code'])

    def catalog(self, category, query='', page=1):
        with self.database.connect() as connection:
            progress = connection.execute('SELECT * FROM jd_pool_progress WHERE elite_id=24').fetchone()
        comparison = JDComparisonService(self.database)
        counts = {key: len(comparison.related(key)) for key in CATEGORIES}
        candidates = comparison.related(category, query)
        total = len(candidates)
        rows = candidates[(page - 1) * 20:page * 20]
        return dict(categoryId=category, page=page, totalCount=total, hasMore=page * 20 < total,
                    scan=dict(scannedPages=progress['scanned_pages'], totalPages=progress['total_pages'],
                              nextPage=progress['next_page'], fullScanAt=progress['full_scan_at']) if progress else None,
                    coverage=[dict(id=key, label=label, count=counts.get(key, 0)) for key, label in CATEGORIES.items()],
                    latestRun=self.run(), items=[dict(id=row['product_id'], itemId=row['item_id'], categoryId=row['category_id'],
                        name=row['name'], brand=row['brand'], shop=row['shop'] or '店铺未提供', price=row['price_cents'] / 100,
                        productUrl=row['product_url'], collectedAt=row['collected_at'], detailsCollectedAt=row['detail_time'],
                        matchStatus='unverified') for row in rows])

    def history(self, product_id):
        with self.database.connect() as connection:
            if not connection.execute('SELECT 1 FROM jd_pool_items WHERE product_id=?', (product_id,)).fetchone():
                return None
            rows = connection.execute('SELECT price_cents,collected_at,task_id FROM price_snapshots WHERE product_id=? ORDER BY collected_at DESC,id DESC LIMIT 100', (product_id,)).fetchall()
        return [dict(price=row['price_cents'] / 100 if row['price_cents'] is not None else None,
                     collectedAt=row['collected_at'], taskId=row['task_id']) for row in rows]
