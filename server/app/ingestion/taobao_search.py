"""Store item-level search evidence; no automatic standard-model/SKU mapping."""
import hashlib
import json
import re
import threading
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit
from ..cleaning.jd_goods import clean_text
from ..integrations.taobao import IDENTIFIER, TaobaoError, money


def safe_url(value):
    if not isinstance(value, str) or len(value) > 4000:
        return None
    if value.startswith('//'):
        value = 'https:' + value
    try:
        url = urlsplit(value)
        if url.scheme in ('http', 'https') and url.hostname in (
            'item.taobao.com', 'detail.tmall.com', 's.click.taobao.com', 'uland.taobao.com', 'click.mz.simba.taobao.com'
        ) and not url.username and not url.password and url.port in (None, 80, 443):
            return value
    except ValueError:
        pass
    return None


def clean_search_item(item):
    basic = item.get('item_basic_info')
    if not isinstance(basic, dict):
        raise ValueError('Missing item_basic_info')
    title = clean_text(basic.get('title'))[:500]
    if not title:
        raise ValueError('Missing title')
    identifier = item.get('item_id')
    identifier = identifier if isinstance(identifier, str) and re.fullmatch(IDENTIFIER, identifier) else None
    prices = item.get('price_promotion_info')
    prices = prices if isinstance(prices, dict) else {}
    publish = item.get('publish_info')
    publish = publish if isinstance(publish, dict) else {}
    sale = item.get('presale_info')
    sale = sale if isinstance(sale, dict) else {}
    presale = money(sale.get('presale_deposit')) is not None or any(
        str(sale.get(key, '')).isdigit() and int(sale[key]) > 0
        for key in ('presale_start_time', 'presale_end_time', 'presale_tail_start_time', 'presale_tail_end_time')
    )
    return dict(itemId=identifier, title=title, brand=clean_text(basic.get('brand_name'))[:100],
                shop=clean_text(basic.get('shop_title'))[:100], category=clean_text(basic.get('category_name'))[:100],
                sellerId=clean_text(basic.get('seller_id'))[:100],
                productUrl=safe_url(publish.get('click_url')),
                reservePriceCents=money(prices.get('reserve_price')),
                discountPriceCents=money(prices.get('zk_final_price')),
                estimatedPriceCents=money(prices.get('final_promotion_price')),
                presale=presale, skuVerified=False, matchStatus='unverified', priceScope='item')


class TaobaoSearchService:
    CACHE_SECONDS = 900
    MIN_INTERVAL_SECONDS = 10
    FAILURE_COOLDOWN_SECONDS = 60
    DAILY_LIMIT = 100

    def __init__(self, database, client):
        self.database = database
        self.client = client
        self.lock = threading.Lock()

    def search(self, keyword, page=1, page_size=20, tmall_only=False):
        keyword = clean_text(keyword)
        if not self.lock.acquire(blocking=False):
            raise TaobaoError('淘宝搜索任务正在进行，请稍后再试')
        task = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        try:
            cached = self.cached(keyword, page, page_size, tmall_only)
            if cached and (datetime.fromisoformat(now) - datetime.fromisoformat(cached['collectedAt'])).total_seconds() < self.CACHE_SECONDS:
                return cached
            with self.database.connect() as db:
                # Serialize admission across backend processes sharing this database.
                db.execute('BEGIN IMMEDIATE')
                latest = db.execute("SELECT status,started_at,finished_at FROM ingestion_tasks WHERE platform='taobao' ORDER BY started_at DESC LIMIT 1").fetchone()
                if latest:
                    elapsed = (datetime.fromisoformat(now) - datetime.fromisoformat(latest['finished_at'] or latest['started_at'])).total_seconds()
                    cooldown = self.FAILURE_COOLDOWN_SECONDS if latest['status'] == 'failed' else self.MIN_INTERVAL_SECONDS
                    if elapsed < cooldown or (latest['status'] == 'running' and elapsed < 120):
                        raise TaobaoError('淘宝查询冷却中，请稍后再试；失败后至少等待 60 秒')
                since = (datetime.fromisoformat(now) - timedelta(days=1)).isoformat()
                count = db.execute("SELECT COUNT(*) FROM ingestion_tasks WHERE platform='taobao' AND started_at>=?", (since,)).fetchone()[0]
                if count >= self.DAILY_LIMIT:
                    raise TaobaoError('已达到本地淘宝查询上限（24 小时 100 次），请使用缓存')
                db.execute('INSERT INTO ingestion_tasks(id,platform,status,started_at) VALUES(?,?,?,?)', (task, 'taobao', 'running', now))
                db.execute('INSERT INTO taobao_searches(task_id,keyword,page,page_size,tmall_only) VALUES(?,?,?,?,?)', (task, keyword, page, page_size, int(tmall_only)))
            try:
                result = self.client.search(keyword, page, page_size, tmall_only=True) if tmall_only else self.client.search(keyword, page, page_size)
                seen = set()
                valid = excluded = 0
                with self.database.connect() as db:
                    db.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES(?,?,?)', (task, now, json.dumps(result['payload'], ensure_ascii=False)))
                    for index, raw in enumerate(result['items']):
                        raw_id = db.execute('INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES(?,?,?)', (task, now, json.dumps(raw, ensure_ascii=False))).lastrowid
                        try:
                            item = clean_search_item(raw)
                        except ValueError:
                            excluded += 1
                            db.execute('INSERT INTO cleaning_events(raw_record_id,rule,action,reason,created_at) VALUES(?,?,?,?,?)', (raw_id, 'taobao-basic', 'excluded', '缺少商品标题或基础结构', now))
                            continue
                        if item['itemId'] and item['itemId'] in seen:
                            excluded += 1
                            continue
                        product_id = None
                        if item['itemId']:
                            seen.add(item['itemId'])
                            product_id = 'taobao-' + hashlib.sha256(item['itemId'].encode()).hexdigest()
                            db.execute('INSERT INTO products(id,platform,platform_product_id,shop,product_url) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET shop=excluded.shop,product_url=excluded.product_url', (product_id, 'taobao', item['itemId'], item['shop'], item['productUrl']))
                            db.execute('INSERT INTO product_details(product_id,title,brand,raw_record_id) VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET title=excluded.title,brand=excluded.brand,raw_record_id=excluded.raw_record_id', (product_id, item['title'], item['brand'], raw_id))
                            db.execute('INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,price_type,collected_at) VALUES(?,?,?,?,?,?)', (product_id, task, raw_id, None if item['presale'] else item['discountPriceCents'], 'listed', now))
                        else:
                            db.execute('INSERT INTO cleaning_events(raw_record_id,rule,action,reason,created_at) VALUES(?,?,?,?,?)', (raw_id, 'taobao-id', 'review', '未返回有效新商品ID，仅保留搜索参考', now))
                        item.update(id=product_id or f'{task}-{index}', collectedAt=now, platform='taobao', source='api')
                        db.execute('INSERT INTO taobao_search_results VALUES(?,?,?,?,?)', (task, index, product_id, raw_id, json.dumps(item, ensure_ascii=False)))
                        valid += 1
                    db.execute('UPDATE taobao_searches SET total_count=?,received_count=?,valid_count=?,excluded_count=? WHERE task_id=?', (result['total'], len(result['items']), valid, excluded, task))
                    db.execute('UPDATE ingestion_tasks SET status=?,finished_at=? WHERE id=?', ('completed', datetime.now(timezone.utc).isoformat(), task))
                return self.get(task)
            except Exception as error:
                message = str(error) if isinstance(error, (TaobaoError, ValueError)) else '淘宝搜索处理失败'
                with self.database.connect() as db:
                    db.execute('UPDATE ingestion_tasks SET status=?,finished_at=? WHERE id=?', ('failed', datetime.now(timezone.utc).isoformat(), task))
                    db.execute('UPDATE taobao_searches SET error_message=? WHERE task_id=?', (message[:300], task))
                raise TaobaoError(message) from None
        finally:
            self.lock.release()

    def cached(self, keyword, page=1, page_size=20, tmall_only=False):
        with self.database.connect() as db:
            row = db.execute('SELECT s.task_id FROM taobao_searches s JOIN ingestion_tasks t ON t.id=s.task_id WHERE keyword=? AND page=? AND page_size=? AND tmall_only=? AND status=? ORDER BY started_at DESC,t.id DESC LIMIT 1', (keyword, page, page_size, int(tmall_only), 'completed')).fetchone()
        return self.get(row['task_id']) if row else None

    def get(self, task):
        with self.database.connect() as db:
            row = db.execute('SELECT s.*,t.status,t.started_at FROM taobao_searches s JOIN ingestion_tasks t ON t.id=s.task_id WHERE task_id=?', (task,)).fetchone()
            if not row:
                return None
            products = db.execute('SELECT payload_json FROM taobao_search_results WHERE task_id=? ORDER BY position', (task,)).fetchall()
        return dict(taskId=task, status=row['status'], keyword=row['keyword'], page=row['page'], pageSize=row['page_size'],
                    total=row['total_count'], received=row['received_count'], valid=row['valid_count'], excluded=row['excluded_count'],
                    collectedAt=row['started_at'], products=[json.loads(r['payload_json']) for r in products])
