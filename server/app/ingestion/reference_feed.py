"""Whole-category reference feed, independent of individual selected model names.

The feed is a third-party, untaxed channel price list, never a merchant quotation.
Retain source rows even if their specifications cannot safely become candidates.
"""
import hashlib
import re
import threading
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from urllib.parse import urljoin
import httpx

SOURCE = 'https://baojia.xinde8.com'
PAGES = dict(cpu='cpu', gpu='gpu', board='mb', ram='ram', ssd='ssd', power='psu', case='case', cooler='cooler')
LOCK = threading.Lock()
ATTEMPTS = {}


class PriceTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.heading = ''
        self.in_heading = False
        self.in_cell = False
        self.cell = ''
        self.cells = []
        self.row_url = ''
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == 'h2': self.in_heading, self.heading = True, ''
        if tag == 'span' and self.in_heading: self.in_heading = False
        if tag == 'tr': self.cells, self.row_url = [], ''
        if tag == 'td': self.in_cell, self.cell = True, ''
        if tag == 'a' and self.in_cell and not self.cells:
            self.row_url = dict(attrs).get('href', '')

    def handle_data(self, data):
        if self.in_heading: self.heading += data
        if self.in_cell: self.cell += data

    def handle_endtag(self, tag):
        if tag == 'h2': self.in_heading = False
        if tag == 'td':
            self.cells.append(' '.join(self.cell.split()))
            self.in_cell = False
        if tag == 'tr' and len(self.cells) >= 2:
            try:
                price = Decimal(self.cells[1].replace('¥', '').replace('￥', '').replace(',', '').strip())
                if not price.is_finite() or price <= 0: return
                self.rows.append(dict(title=self.cells[0], brand=self.heading.strip(), price_cents=int(price * 100),
                                      source_url=urljoin(SOURCE, self.row_url) if self.row_url.startswith('/p/') else ''))
            except InvalidOperation:
                pass


def refresh_references(database, category, force=False, transport=None):
    if category not in PAGES: raise ValueError('未知配件类别')
    now = datetime.now(timezone.utc)
    with database.connect() as db:
        latest = db.execute('SELECT MAX(checked_at) AS checked,COUNT(*) AS count FROM public_reference_records WHERE category=?', (category,)).fetchone()
    if not force and latest['checked'] and latest['checked'] > (now - timedelta(hours=24)).isoformat():
        return dict(category=category, status='cached', rows=latest['count'])
    with LOCK:
        last = ATTEMPTS.get((str(database.path), category))
        if not force and last and now - last < timedelta(minutes=10):
            return dict(category=category, status='cooldown', rows=latest['count'])
        ATTEMPTS[(str(database.path), category)] = now
    url = f'{SOURCE}/c/{PAGES[category]}.html'
    try:
        with httpx.Client(timeout=20, follow_redirects=False, transport=transport) as client:
            response = client.get(url, headers={'User-Agent': 'NexBuild/1.0 (public reference price reader)'})
            response.raise_for_status()
        parser = PriceTable()
        parser.feed(response.text)
        if not parser.rows: return dict(category=category, status='empty_source', rows=latest['count'])
        date = re.search(r'更新于\s*(\d{4}-\d{2}-\d{2})', response.text)
        source_date = date[1] if date else '来源未标明日期'
        with database.connect() as db:
            # Replace only after a complete successful parse. Failed updates keep the old data.
            db.execute('DELETE FROM public_reference_records WHERE category=?', (category,))
            for row in parser.rows:
                identifier = hashlib.sha256((category + row['brand'] + row['title']).encode()).hexdigest()[:28]
                db.execute('INSERT OR REPLACE INTO public_reference_records VALUES(?,?,?,?,?,?,?,?)',
                           ('public-' + identifier, category, row['brand'], row['title'], row['price_cents'],
                            row['source_url'] or url, now.isoformat(), source_date))
        return dict(category=category, status='updated', rows=len(parser.rows))
    except httpx.HTTPError:
        return dict(category=category, status='source_unavailable', rows=latest['count'])
