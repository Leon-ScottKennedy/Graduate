"""Explicitly confirmed model mappings and user recorded prices, independent of affiliate APIs."""
import csv
import hashlib
import io
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from urllib.parse import urlsplit, parse_qs, urlencode, urlunsplit
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, ValidationError
from ..cleaning.jd_categories import CATEGORIES

router = APIRouter(prefix='/api/quotes')


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    category: str = Field(min_length=1, max_length=20)
    brand: str = Field(min_length=1, max_length=100)
    modelName: str = Field(min_length=3, max_length=200)
    specs: str = Field(min_length=1, max_length=500)

    @field_validator('category')
    @classmethod
    def category_known(cls, value):
        if value not in CATEGORIES:
            raise ValueError('未知配件类别')
        return value

    def key(self):
        return hashlib.sha256(self.model_dump_json().encode()).hexdigest()


class Quote(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    platform: Literal['jd', 'taobao']
    shop: str = Field(min_length=1, max_length=100)
    productUrl: str = Field(min_length=1, max_length=2000)
    price: Decimal = Field(gt=0, le=1000000, decimal_places=2)
    shipping: Decimal = Field(default=Decimal('0'), ge=0, le=10000, decimal_places=2)
    observedAt: datetime
    note: str = Field(default='', max_length=300)

    @model_validator(mode='after')
    def valid_quote(self):
        url = urlsplit(self.productUrl)
        hosts = ('item.jd.com',) if self.platform == 'jd' else ('item.taobao.com', 'detail.tmall.com')
        if url.scheme != 'https' or url.hostname not in hosts or url.username or url.password or url.port not in (None, 443):
            raise ValueError('请使用与平台对应的完整 HTTPS 商品链接')
        query = parse_qs(url.query)
        if self.platform == 'jd':
            import re
            if not re.fullmatch(r'/\d+\.html', url.path):
                raise ValueError('京东链接应为 item.jd.com/商品编号.html')
            self.productUrl = 'https://item.jd.com' + url.path
        else:
            if len(query.get('id', [])) != 1 or not query['id'][0].strip():
                raise ValueError('淘宝链接必须包含唯一商品 id')
            kept = {'id': query['id'][0]}
            if 'skuId' in query:
                if len(query['skuId']) != 1:
                    raise ValueError('商品规格标识不唯一')
                kept['skuId'] = query['skuId'][0]
            self.productUrl = urlunsplit(('https', url.hostname, url.path, urlencode(kept), ''))
        if self.observedAt.tzinfo is None:
            raise ValueError('采集时间必须包含时区')
        self.observedAt = self.observedAt.astimezone(timezone.utc)
        if self.observedAt > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError('采集时间不能在未来')
        return self


class Import(BaseModel):
    model_config = ConfigDict(extra='forbid')
    target: Model
    confirmed: Literal[True]
    quotes: list[Quote] = Field(min_length=1, max_length=100)


class CSVImport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    target: Model
    confirmed: Literal[True]
    csv: str = Field(min_length=1, max_length=200000)


def save(database, body, source):
    model_id = body.target.key()
    now = datetime.now(timezone.utc).isoformat()
    # Validation of the full batch occurs before opening the transaction.
    with database.connect() as db:
        db.execute('INSERT OR IGNORE INTO quote_models VALUES(?,?,?,?,?)',
                   (model_id, body.target.category, body.target.brand, body.target.modelName, body.target.specs))
        for quote in body.quotes:
            key = hashlib.sha256(json.dumps([model_id, quote.platform, quote.shop, quote.productUrl], ensure_ascii=False).encode()).hexdigest()
            db.execute('INSERT INTO manual_quotes VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET active=1',
                       (key, model_id, quote.platform, quote.shop, quote.productUrl))
            values = (key, int(quote.price * 100), int(quote.shipping * 100), quote.observedAt.isoformat(), quote.note)
            exists = db.execute('SELECT 1 FROM manual_quote_prices WHERE quote_id=? AND price_cents=? AND shipping_cents=? AND observed_at=? AND note=?', values).fetchone()
            if not exists:
                db.execute('INSERT INTO manual_quote_prices(quote_id,price_cents,shipping_cents,observed_at,note,recorded_at,source) VALUES(?,?,?,?,?,?,?)', (*values, now, source))
    return dict(imported=len(body.quotes), modelId=model_id)


@router.post('/import')
def import_quotes(body: Import, request: Request):
    return save(request.app.state.database, body, 'manual')


@router.post('/import-csv')
def import_csv(body: CSVImport, request: Request):
    try:
        reader = csv.DictReader(io.StringIO(body.csv.lstrip('\ufeff')), strict=True)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError('表头重复或缺失')
        rows = []
        for index, row in enumerate(reader, 2):
            if index > 101:
                raise ValueError('一次最多100条')
            try:
                rows.append(Quote.model_validate(row))
            except (ValidationError, ValueError):
                raise ValueError(f'第{index}行字段无效，请核对平台、链接、价格和带时区的时间') from None
        parsed = Import(target=body.target, confirmed=body.confirmed, quotes=rows)
    except (ValueError, csv.Error, ValidationError) as error:
        raise HTTPException(422, str(error)[:250]) from None
    return save(request.app.state.database, parsed, 'csv')


@router.post('/compare')
def compare(target: Model, request: Request):
    with request.app.state.database.connect() as db:
        rows = db.execute('''WITH latest AS (
            SELECT *, ROW_NUMBER() OVER(PARTITION BY quote_id ORDER BY observed_at DESC,id DESC) AS rank
            FROM manual_quote_prices)
            SELECT q.*, p.price_cents,p.shipping_cents,p.observed_at,p.recorded_at,p.note,p.source
            FROM manual_quotes q JOIN latest p ON p.quote_id=q.id AND p.rank=1
            WHERE q.model_id=? AND q.active=1 ORDER BY p.price_cents+p.shipping_cents,q.id''', (target.key(),)).fetchall()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    offers = [dict(id=r['id'], platform=r['platform'], shop=r['shop'], productUrl=r['product_url'],
                   price=r['price_cents']/100, shipping=r['shipping_cents']/100,
                   total=(r['price_cents']+r['shipping_cents'])/100,
                   observedAt=r['observed_at'], note=r['note'], source=r['source'],
                   stale=datetime.fromisoformat(r['observed_at']) < cutoff) for r in rows]
    fresh = [q for q in offers if not q['stale']]
    lowest = min((q['total'] for q in fresh), default=None)
    for quote in offers:
        quote['difference'] = round(quote['total'] - lowest, 2) if lowest is not None and not quote['stale'] else None
    return dict(offers=offers, lowest=lowest, shopCount=len({(q['platform'], q['shop']) for q in fresh}))


@router.get('/{quote_id}/history')
def history(quote_id: str, request: Request):
    with request.app.state.database.connect() as db:
        rows = db.execute('SELECT price_cents,shipping_cents,observed_at,source FROM manual_quote_prices WHERE quote_id=? ORDER BY observed_at DESC,id DESC LIMIT 100', (quote_id,)).fetchall()
    return [dict(price=r['price_cents']/100, shipping=r['shipping_cents']/100, observedAt=r['observed_at'], source=r['source']) for r in rows]


@router.delete('/{quote_id}')
def deactivate(quote_id: str, request: Request):
    with request.app.state.database.connect() as db:
        db.execute('UPDATE manual_quotes SET active=0 WHERE id=?', (quote_id,))
    return dict(removed=True)
