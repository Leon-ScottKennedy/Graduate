"""Local, deduplicated market evidence from both official integrations."""
import re
import json
from urllib.parse import urlencode
from datetime import datetime, timezone, timedelta
from ..cleaning.model_match import brand_key, fold, matches
from ..cleaning.jd_categories import hardware_category, NAMES
from .taobao_search import safe_url


GPU_BRANDS = (
    '华硕', 'asus', '微星', 'msi', '技嘉', 'gigabyte', '七彩虹', 'colorful',
    '影驰', 'galax', '索泰', 'zotac', '映众', 'inno3d', '耕升', 'gainward',
    '蓝宝石', 'sapphire', '迪兰', 'dataland', '讯景', 'xfx', '撼讯', 'powercolor',
)


def allowed_gpu(title, brand):
    """User-selected vendor allowlist; keep original evidence in the database."""
    if re.search(r'二手|拆机|翻新|矿卡|维修|无拆|无修|未拆未修|水冷头|扣具|支架|空盒|包装盒|租赁|定金|补差|差价', title):
        return False
    # Reject the explicitly excluded vendor even if upstream brand metadata is wrong.
    if re.search(r'(?<![a-z])pny(?![a-z])|必恩威', title, re.I):
        return False
    text = title + ' ' + brand
    return any(re.search(r'(?<![a-z])' + alias + r'(?![a-z])', text, re.I)
               if alias.isascii() else alias in text for alias in GPU_BRANDS)


def gpu_families(text):
    """Chip identity excludes board-vendor editions such as O12G and VENTUS 2X."""
    return {''.join(part or '' for part in match).upper() for match in re.findall(
        r'(?<![a-z0-9])(rtx|gtx|rx|arc)\s*-?\s*(\d{3,4})\s*(ti|xtx|xt|gre)?\s*(super)?(?![a-z0-9])',
        text.casefold())}


def merchant_profile(platform, shop, raw):
    """Rank merchant hints without claiming that a shop name verifies brand ownership."""
    if platform == 'jd':
        return (0, '京东自营') if raw.get('owner') == 'g' else (2, '京东')
    basic = raw.get('item_basic_info') or {}
    tmall = str(basic.get('user_type')) == '1'
    flagship_hint = bool(re.search(r'官方旗舰店|旗舰店|官方店|专卖店', shop))
    if tmall and flagship_hint:
        return 0, '天猫'
    if flagship_hint:
        return 1, '淘宝'
    return (2, '天猫') if tmall else (3, '淘宝')


def market_keyword(category, brand, name, specs):
    vendor = brand.split()[0] if brand.split() else ''
    if category == 'gpu':
        families = gpu_families(name + ' ' + specs)
        if len(families) == 1:
            chip = re.sub(r'^(RTX|GTX|RX|ARC)(\d+)(.*)$', r'\1 \2 \3', next(iter(families)))
            chip = chip.replace('TISUPER', 'Ti SUPER').strip()
            return ' '.join((vendor + ' ' + chip).split())[:120]
    if category == 'cpu':
        chips = re.findall(r'(?<![a-z0-9])\d{4}[a-z0-9]*(?![a-z0-9])', name, re.I)
        if len(chips) == 1:
            return (vendor + ' ' + chips[0]).strip()
    return name[:120]


class MarketComparisonService:
    def __init__(self, database):
        self.database = database

    def compare(self, category, brand, name, specs, page=1, platform='all'):
        # Read the latest snapshot even when its price is invalid. Never resurrect an old price.
        with self.database.connect() as db:
            rows = db.execute('''SELECT p.*, d.title, d.brand, s.price_cents,s.collected_at,r.payload_json
                FROM products p JOIN product_details d ON d.product_id=p.id
                JOIN raw_records r ON r.id=d.raw_record_id
                JOIN price_snapshots s ON s.id=(SELECT id FROM price_snapshots
                    WHERE product_id=p.id AND price_type='listed'
                    ORDER BY collected_at DESC,id DESC LIMIT 1)
                ORDER BY s.collected_at DESC,p.id''').fetchall()
        tokens = re.findall(r'[a-z0-9]+', name.casefold())
        models = [token for token in tokens if len(token) >= 3 and any(c.isdigit() for c in token)]
        models = [token for token in models if not re.fullmatch(r'\d+(?:gb|tb|w)', token)]
        families = gpu_families(name + ' ' + specs) if category == 'gpu' else set()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        items = []
        seen = set()
        for row in rows:
            if platform != 'all' and row['platform'] != platform:
                continue
            title = row['title']
            # Affiliate item IDs can rotate between scans. Show the newest evidence
            # once per identical platform/shop/title while preserving all raw records.
            identity = (row['platform'], fold(row['shop']) or row['id'], fold(title))
            if identity in seen:
                continue
            seen.add(identity)
            if category == 'gpu' and not allowed_gpu(title, row['brand']):
                continue
            # References can be broader than exact edition/spec matches, but must share a model token.
            related = bool(models) and all(re.search(r'(?<!\d)' + re.escape(token) + r'(?!\d)', fold(title)) for token in models)
            if families:
                related = len(families) == 1 and gpu_families(title) == families
            if category == 'ram':
                related = related and brand_key(brand) == brand_key(row['brand'])
            exact = matches(category, brand, name, specs, dict(name=title, brand=row['brand']))
            raw = json.loads(row['payload_json'])
            source_category = hardware_category(raw) if row['platform'] == 'jd' else NAMES.get(
                (raw.get('item_basic_info') or {}).get('category_name'))
            if source_category and source_category != category:
                exact = False
                continue
            if re.search(r'水冷头|扣具|支架|转接|适用|兼容|预售|定金', title):
                exact = False
            if not exact and not related and (families or fold(name) not in fold(title)):
                continue
            stale = row['collected_at'] < cutoff
            merchant_rank, platform_label = merchant_profile(row['platform'], row['shop'], raw)
            items.append(dict(id=row['id'], platform=row['platform'], title=title, shop=row['shop'],
                              platformLabel=platform_label, merchantRank=merchant_rank,
                              productUrl=safe_url(row['product_url']) if row['platform'] == 'taobao' else row['product_url'],
                              price=row['price_cents'] / 100 if row['price_cents'] is not None else None,
                              collectedAt=row['collected_at'], stale=stale,
                              matchStatus='title_match' if exact else 'reference',
                              relationLabel='同芯片参考 · 品牌及具体规格待确认' if families and related else '相关商品 · 型号规格待确认'))
        items.sort(key=lambda item: (item['price'] is None, item['stale'], item['merchantRank'], item['matchStatus'] != 'title_match',
                                     item['price'] or 0, item['id']))
        counts = {key: sum(item['platform'] == key for item in items) for key in ('jd', 'taobao')}
        keyword = market_keyword(category, brand, name, specs)
        return dict(total=len(items), counts=counts, page=page, pageSize=30, searchKeyword=keyword,
                    storeSearches=[dict(platform='jd', label='去京东找店铺', url='https://search.jd.com/Search?' + urlencode(dict(keyword=keyword, enc='utf-8'))),
                                   dict(platform='taobao', label='去天猫找店铺', url='https://list.tmall.com/search_product.htm?' + urlencode(dict(q=keyword)))],
                    products=items[(page-1)*30:page*30])
