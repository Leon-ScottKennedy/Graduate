"""Build a reviewable brand-priority shortlist without deleting source evidence.

Shop names never establish official ownership. Item-level prices and model/SKU
identity remain unverified, so this file is not an automatic build catalog.
"""
import json
import argparse
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.repositories.database import Database
from app.cleaning.jd_categories import hardware_category
from app.cleaning.merchant_identity import merchant_identity

BRANDS = {
    'gpu': {'asus': ['华硕', 'asus'], 'gigabyte': ['技嘉', 'gigabyte'], 'msi': ['微星', 'msi'], 'sapphire': ['蓝宝石', 'sapphire']},
    'cpu': {'amd': ['amd'], 'intel': ['英特尔', 'intel']},
    'board': {'asus': ['华硕', 'asus'], 'gigabyte': ['技嘉', 'gigabyte'], 'msi': ['微星', 'msi'], 'asrock': ['华擎', 'asrock']},
    'ram': {'samsung': ['三星', 'samsung'], 'kingston': ['金士顿', 'kingston'], 'gskill': ['芝奇', 'g.skill'], 'corsair': ['海盗船', 'corsair'], 'crucial': ['英睿达', 'crucial']},
    'ssd': {'samsung': ['三星', 'samsung'], 'wd': ['西部数据', 'western digital'], 'kingston': ['金士顿', 'kingston'], 'crucial': ['英睿达', 'crucial'], 'kioxia': ['铠侠', 'kioxia']},
    'power': {'seasonic': ['海韵', 'seasonic'], 'corsair': ['海盗船', 'corsair'], 'superflower': ['振华', 'super flower'], 'fsp': ['全汉', 'fsp'], 'huntkey': ['航嘉', 'huntkey']},
    'case': {'lianli': ['联力', 'lian li'], 'fractal': ['分形工艺', 'fractal'], 'corsair': ['海盗船', 'corsair'], 'deepcool': ['九州风神', 'deepcool'], 'coolermaster': ['酷冷至尊', 'cooler master']},
    'cooler': {'thermalright': ['利民', 'thermalright'], 'deepcool': ['九州风神', 'deepcool'], 'noctua': ['猫头鹰', 'noctua'], 'coolermaster': ['酷冷至尊', 'cooler master'], 'corsair': ['海盗船', 'corsair']},
}
CATEGORIES = [('gpu', '显卡'), ('board', '主板'), ('ram', '内存'), ('ssd', '固态硬盘'), ('power', '电源'), ('case', '机箱'), ('cooler', '散热器'), ('cpu', '处理器')]
REJECT = re.compile(r'二手|拆机|翻新|矿卡|维修|回收|租赁|定金|订金|补差|差价|空盒|包装盒|水冷头|扣具|支架|服务器|笔记本|准系统|整机|主机套装|主板套装|板U套装|板u套装|内存颗粒|散热马甲|转接|延长线|硅脂|导热垫|机箱风扇')
CATEGORY_TITLES = {
    'gpu': r'显卡|RTX\s*\d|RX\s*\d|GTX\s*\d',
    'cpu': r'处理器|锐龙|酷睿|Ryzen|Core\s|CPU',
    'board': r'主板|motherboard',
    'ram': r'内存|DDR[345]',
    'ssd': r'固态|SSD|NVME',
    'power': r'电源|PSU',
    'case': r'机箱|chassis',
    'cooler': r'散热器|风冷|水冷|双塔|单塔',
}


def brand_for(category, title, brand):
    # A brand in the shop name or search keyword is insufficient evidence.
    def identify(text):
        text = text.casefold()
        for canonical, aliases in BRANDS.get(category, {}).items():
            if any(re.search(r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])', text) if alias.isascii() else alias in text for alias in aliases):
                return canonical
    if brand and brand.casefold() not in ('其他', '其它', 'other', '无品牌'):
        return identify(brand)
    # Memory IC manufacturer is not necessarily the assembled module's brand.
    if category == 'ram' and re.search(r'三星颗粒|三星芯片|三星B.?DIE', title, re.I):
        return None
    return identify(title)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--since-task', help='Include collection totals since this task started')
    args = parser.parse_args()
    settings = Settings.from_environment()
    database = Database(settings.database_path)
    database.initialize()
    with database.connect() as db:
        acquisition = {}
        since = None
        if args.since_task:
            first = db.execute('SELECT started_at FROM ingestion_tasks WHERE id=?', (args.since_task,)).fetchone()
            if not first:
                raise ValueError('Unknown start task')
            since = first['started_at']
            acquisition['taobao'] = dict(db.execute('''SELECT COUNT(*) AS pages,
                COALESCE(SUM(q.received_count),0) AS received,
                COALESCE(SUM(q.valid_count),0) AS structurallyValid
                FROM taobao_searches q JOIN ingestion_tasks t ON t.id=q.task_id
                WHERE t.started_at>=? AND t.status='completed' ''', (first['started_at'],)).fetchone())
            acquisition['jd'] = dict(db.execute('''SELECT COUNT(*) AS runs,
                COALESCE(SUM(q.pages_completed),0) AS pages,
                COALESCE(SUM(q.received_count),0) AS received,
                COALESCE(SUM(q.valid_count),0) AS hardwareRecords
                FROM jd_pool_runs q JOIN ingestion_tasks t ON t.id=q.task_id
                WHERE t.started_at>=? AND t.status='completed' ''', (first['started_at'],)).fetchone())
        rows = db.execute('''SELECT p.id,p.platform,p.platform_product_id,p.shop,p.product_url,
            s.price_cents,s.collected_at,r.payload_json,
            (SELECT q.keyword FROM taobao_searches q WHERE q.task_id=s.task_id) AS keyword
            FROM products p JOIN price_snapshots s ON s.id=(SELECT x.id FROM price_snapshots x
            WHERE x.product_id=p.id ORDER BY x.collected_at DESC,x.id DESC LIMIT 1)
            JOIN raw_records r ON r.id=s.raw_record_id''').fetchall()
    shortlist, rejected = [], Counter()
    for row in rows:
        raw = json.loads(row['payload_json'])
        if row['platform'] == 'jd':
            title, brand = raw.get('skuName', ''), raw.get('brandName', '')
            category = hardware_category(raw)
            merchant = 'jd_self_operated' if raw.get('owner') == 'g' else 'jd_unverified'
        else:
            basic = raw.get('item_basic_info') or {}
            title, brand = basic.get('title', ''), basic.get('brand_name', '')
            category = next((key for key, term in CATEGORIES if term in (row['keyword'] or '')), None)
            merchant = 'tmall' if str(basic.get('user_type')) == '1' else 'taobao_unverified'
        if not category:
            rejected['unknown_category'] += 1
            continue
        if REJECT.search(title):
            rejected['used_accessory_or_wrong_product'] += 1
            continue
        if not re.search(CATEGORY_TITLES[category], title, re.I):
            rejected['title_category_not_confirmed'] += 1
            continue
        if category in ('cpu', 'board', 'gpu') and re.search(r'套装|套餐', title):
            rejected['bundle_price_ambiguous'] += 1
            continue
        canonical = brand_for(category, title, brand)
        if not canonical:
            rejected['outside_priority_brands'] += 1
            continue
        if not row['price_cents'] or row['price_cents'] <= 0:
            rejected['missing_or_presale_price'] += 1
            continue
        if merchant == 'taobao_unverified':
            rejected['not_confirmed_tmall'] += 1
            continue
        shortlist.append(dict(id=row['id'], platform=row['platform'], category=category,
            brand=canonical, title=title, shop=row['shop'], merchantEvidence=merchant,
            **merchant_identity(row['platform'], row['shop'], raw), priceCents=row['price_cents'],
            priceScope='item_not_verified_sku', modelVerified=False,
            productUrl=row['product_url'], collectedAt=row['collected_at'],
            reviewRequired=True))
    ranks = {'jd_self_operated': 0, 'tmall': 1, 'jd_unverified': 2}
    shortlist.sort(key=lambda item: (ranks[item['merchantEvidence']], item['category'], item['brand'], item['title']))
    review_queue = [item for item in shortlist if item['merchantEvidence'] != 'jd_self_operated']
    shortlist = [item for item in shortlist if item['merchantEvidence'] == 'jd_self_operated']
    for item in shortlist:
        item['merchantVerified'] = True
        item['merchantVerificationBasis'] = 'JD API owner=g; platform self-operated, not brand ownership'
    for item in review_queue:
        item['merchantVerified'] = False
        item['merchantVerificationBasis'] = 'Platform type/shop name does not establish official ownership'
    review_output = settings.database_path.parent / 'priority_hardware_review.json'
    review_output.write_text(json.dumps(dict(
        note='Quarantined: merchant ownership unverified. Do not use as trusted offers.',
        count=len(review_queue), products=review_queue), ensure_ascii=False, indent=2), encoding='utf-8')
    shops = {}
    for item in shortlist + review_queue:
        key = (item['platform'], item['shop'])
        record = shops.setdefault(key, dict(platform=item['platform'], shop=item['shop'],
            storeLabels=item['storeLabels'], officialStoreStatus=item['officialStoreStatus'],
            merchantVerified=item['merchantVerified'], evidence=item['merchantVerificationBasis'], products=0))
        record['products'] += 1
    audit_output = settings.database_path.parent / 'merchant_verification_audit.json'
    audit_output.write_text(json.dumps(dict(
        generatedAt=datetime.now(timezone.utc).isoformat(), shops=list(shops.values()),
        verifiedProducts=len(shortlist), quarantinedProducts=len(review_queue),
        officialBrandStoresVerified=0,
        limitation='No collected Tmall seller ID has been matched to authoritative brand/platform ownership evidence.'
    ), ensure_ascii=False, indent=2), encoding='utf-8')
    output = settings.database_path.parent / 'priority_hardware.json'
    report = dict(generatedAt=datetime.now(timezone.utc).isoformat(),
        acquisition=acquisition,
        note='Strict merchant gate: JD API self-operated only. Exact model/SKU prices still require review.',
        quarantinedMerchantProducts=len(review_queue),
        totalSourceProducts=len(rows), shortlisted=len(shortlist), rejected=dict(rejected),
        newlyCollectedShortlist=sum(1 for item in shortlist if since and item['collectedAt'] >= since),
        byCategory=dict(Counter(item['category'] for item in shortlist)),
        byMerchantEvidence=dict(Counter(item['merchantEvidence'] for item in shortlist)), products=shortlist)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'products'}, ensure_ascii=True))


if __name__ == '__main__':
    main()
