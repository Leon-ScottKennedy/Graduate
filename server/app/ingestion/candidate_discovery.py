"""Discover other brands by specification, independently of a hard-coded model list.

Only unambiguous title evidence is promoted to a comparison item. Unknown dimensions,
timings, BIOS and measured performance remain unknown, not copied from the selection.
"""
import hashlib
import json
import re
import time
import threading
import unicodedata
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit
from ..cleaning.model_match import BRANDS, brand_key, capacities, matches
from ..cleaning.jd_categories import hardware_category, NAMES
from ..cleaning.merchant_identity import merchant_identity
from ..integrations.jd.client import JDError
from ..integrations.taobao import TaobaoError
from .jd_search import JDSearchService
from .taobao_search import safe_url
from .reference_feed import refresh_references

EXCLUDED = re.compile(r'二手|拆机|翻新|矿卡|维修|租赁|定金|补差|差价|空盒|包装盒|整机|组装机|电脑主机|全家桶|笔记本|服务器|适用|兼容|转接|扣具|支架|硅脂|导热膏|预售|套餐')


def one(pattern, text):
    values = set(re.findall(pattern, text, re.I))
    return next(iter(values)) if len(values) == 1 else None


def profile(category, text):
    text = unicodedata.normalize('NFKC', text).upper()
    capacity = capacities(text)
    size = int(next(iter(capacity))) if len(capacity) == 1 else None
    if category == 'gpu':
        if re.search(r'\d{4}[^，。]{0,12}[/|][^，。]{0,12}\d{4}', text):
            return None
        chips = {re.sub(r'[\s-]', '', chip) for chip in re.findall(r'(?:RTX|GTX|RX|ARC)\s*-?\s*\d{3,4}(?:\s*(?:XTX|TI|XT|GRE))?(?:\s*SUPER)?(?:\s*D\b)?', text)}
        return (next(iter(chips)), size) if len(chips) == 1 and size else None
    if category == 'board':
        chip = one(r'\b[ABXZH]\d{3}(?:E)?(?=M|\W|$)', text)
        memory = one(r'DDR[345]', text)
        form = one(r'M-ATX|MINI-ITX|E-ATX|\bATX\b', text)
        if not form and chip:
            form = 'M-ATX' if re.search(re.escape(chip) + r'M\b', text) else None
        socket = one(r'AM[45]|LGA\s*\d{4}', text)
        if not socket and chip in ('A620', 'B650', 'B650E', 'B850', 'X670', 'X670E', 'X870', 'X870E'):
            socket = 'AM5'
            memory = memory or 'DDR5'
        return (chip, socket, memory, form) if all((chip, socket, memory, form)) else None
    if category == 'ram':
        memory = one(r'DDR[345]', text)
        speed = one(r'(?<!\d)(?:[3456789]\d{3})(?=\s*(?:MT/S|MHZ|HZ)|\s*C\d|\s*CL|\s*(?:\d+GB|\d+G\b))', text)
        speed = speed or one(r'(?<=DDR5 )\d{4}|(?<=DDR4 )\d{4}', text)
        kits = re.findall(r'(\d+)\s*G(?:B)?\s*[×X*]\s*(\d+)', text)
        modules = int(kits[0][1]) if len(kits) == 1 else None
        return (memory, size, int(speed) if speed else None, modules) if memory and size and modules else None
    if category == 'ssd':
        gen = one(r'(?:PCIE|PCI-E|GEN)\s*([345])(?:\.0)?', text)
        return (size, gen) if size and gen and re.search(r'NVME|M\.2', text) else None
    if category == 'power':
        watts = one(r'(?<!\d)(\d{3,4})\s*W\b', text)
        return (int(watts),) if watts else None
    if category == 'cooler':
        radiator = one(r'(120|240|280|360|420)\s*(?:MM)?\s*(?:水冷|冷排)', text)
        if radiator:
            return ('水冷', radiator)
        tower = one(r'双塔|单塔', text) or ('塔式' if re.search(r'塔式风冷|风冷', text) else None)
        return ('风冷', tower) if tower else None
    if category == 'case':
        form = one(r'M-ATX|MINI-ITX|E-ATX|\bATX\b', text)
        return (form,) if form else None
    if category == 'cpu':
        family = one(r'RYZEN\s+[3579]', text)
        model = one(r'(?<!\d)[789]\d{3}(?:X3D|X|F|G)?\b', text)
        if family and model: return (family, 'AM5', 'X3D' in model)
        family = one(r'(?:CORE\s+)?I[3579]', text)
        model = one(r'(?<!\d)(?:12|13|14)\d{3}(?:KF|K|F)?\b', text)
        if family and model:
            return (family.replace('CORE ', ''), 'LGA1700', False)
        return None
    return None


def compatible(category, target, candidate):
    if not target or not candidate:
        return False
    if category == 'ram':
        return target[0:2] == candidate[0:2] and target[3] == candidate[3] and (
            not target[2] or (candidate[2] and abs(candidate[2] / target[2] - 1) <= .1))
    if category == 'cooler':
        return target[0] == candidate[0] and (target[1] == candidate[1] or
            (target[0] == '风冷' and '塔式' in (target[1], candidate[1])))
    return target == candidate


def keyword(category, key):
    if category == 'gpu': return f'{re.sub(r"^(RTX|GTX|RX|ARC)", r"\1 ", key[0])} {key[1]}GB 显卡'
    if category == 'board': return f'{key[0]} {key[1]} {key[2]} {key[3]} 主板'
    if category == 'ram': return f'{key[0]} {key[1]}GB {key[2] or ""} {key[3]}条套装 内存'
    if category == 'ssd': return f'{key[0] // 1024 if key[0] >= 1024 else key[0]}{"TB" if key[0] >= 1024 else "GB"} PCIe {key[1]}.0 NVMe 固态硬盘'
    if category == 'power': return f'{key[0]}W 电源'
    if category == 'cpu': return f'{key[0]} {"X3D" if key[2] else key[1]} 处理器'
    return ' '.join(key) + (' 散热器' if category == 'cooler' else ' 机箱')


def find_reference_candidates(state, selected, catalog):
    category = selected.category
    target = profile(category, selected.modelName + ' ' + selected.specs)
    if not target: return []
    with state.database.connect() as db:
        rows = db.execute('SELECT * FROM public_reference_records WHERE category=? AND checked_at>?',
                          (category, (datetime.now(timezone.utc) - timedelta(days=7)).isoformat())).fetchall()
    options = []
    for row in rows:
        vendor = brand_key(row['brand'])
        if vendor not in {name for name, _ in BRANDS} or (category != 'cpu' and vendor == brand_key(selected.brand)):
            continue
        title = row['title']
        if re.search(r'拆|二手|翻新|笔记本|服务器|定金|套餐', title): continue
        # Expand only source spelling, never infer a chip/capacity from its price.
        if category == 'cpu':
            title = re.sub(r'\bI([3579])\s*-?\s*((?:12|13|14)\d{3}(?:KF|K|F)?)', r'Intel Core i\1-\2', title, flags=re.I)
            title = re.sub(r'\bR([3579])\s*-?\s*([789]\d{3}(?:X3D|X|F|G)?)', r'AMD Ryzen \1 \2', title, flags=re.I)
        known = next((part for part in catalog if part.category == category and matches(category, part.brand, part.modelName,
                     part.specs, dict(name=title, brand=row['brand']))), None)
        text = (known.modelName + ' ' + known.specs) if known else title
        key = profile(category, text)
        paired = False
        if category == 'ram' and not key:
            sizes = capacities(title)
            if len(sizes) == 1:
                single = int(next(iter(sizes)))
                key = profile(category, title + f' {single}GBx1')
                if key and target[3] > 1 and single * target[3] == target[1]:
                    key = (key[0], single * target[3], key[2], target[3])
                    paired = True
        if not compatible(category, target, key): continue
        if category == 'cpu':
            chip = r'(?<!\d)(?:[789]\d{3}(?:X3D|X|F|G)?|(?:12|13|14)\d{3}(?:KF|K|F)?)\b'
            if one(chip, title.upper()) == one(chip, selected.modelName.upper()): continue
        price = row['price_cents'] / 100 * (target[3] if paired else 1)
        specifications = known.specs if known else title
        name = known.modelName if known else row['brand'] + ' ' + title
        if category == 'gpu': specifications = f'{key[0]} · {key[1]}GB · 尺寸及供电接口待核验'
        if category == 'board': specifications = ' · '.join(key)
        if category == 'ram':
            specifications = f'{key[1] // key[3]}GB × {key[3]} · {key[0]}' + (f' · {key[2]}MT/s' if key[2] else ' · 频率待核验')
            name = f'{row["brand"]} {key[1]}GB {title}' + (' × 2（两条单买）' if paired else '')
        if category == 'ssd': specifications = f'{key[0]}GB · M.2 NVMe · PCIe {key[1]}.0'
        if category == 'cpu': specifications = key[1] + ' · 参数待核验'
        note = f'整类报价表条目：{row["title"]}；来源标注日期{row["source_date"]}。未税渠道参考，不是店铺售价或库存承诺。'
        if paired: note += f'两条单买预算＝单条{row["price_cents"] / 100:g}元×{target[3]}，不是原厂双条套装报价；未计运费。'
        option = dict(id=known.id if known and not paired else row['id'] + ('-pair' if paired else ''),
                      brand=known.brand if known else row['brand'], name=name[:200], specs=specifications, price=price,
                      tag='两条单买预算 · 估算参考价' if paired else '未税渠道参考价',
                      referencePrice=dict(amount=price, currency='CNY', basis='estimated' if paired else 'public',
                        sourceName='整类配件渠道报价表', sourceUrl=row['source_url'], checkedAt=row['checked_at'][:10], note=note))
        if category == 'power': option['psuWatts'] = key[0]
        options.append(option)
    return options[:80]


def find_candidates(state, selected, catalog):
    category = selected.category
    target = profile(category, selected.modelName + ' ' + selected.specs)
    if not target: return [], 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    with state.database.connect() as db:
        rows = db.execute('''SELECT p.*,d.title,d.brand,r.payload_json,s.price_cents,s.collected_at
            FROM products p JOIN product_details d ON d.product_id=p.id
            JOIN raw_records r ON r.id=d.raw_record_id
            JOIN price_snapshots s ON s.id=(SELECT id FROM price_snapshots
              WHERE product_id=p.id AND price_type='listed' ORDER BY collected_at DESC,id DESC LIMIT 1)
            ORDER BY s.collected_at DESC,p.id''').fetchall()
    found = {}
    rejected = 0
    for row in rows:
        title = row['title']
        raw = json.loads(row['payload_json'])
        source_category = hardware_category(raw) if row['platform'] == 'jd' else NAMES.get((raw.get('item_basic_info') or {}).get('category_name'))
        if source_category != category: continue
        vendor = brand_key(row['brand'])
        if vendor not in {name for name, _ in BRANDS} or (vendor == brand_key(selected.brand) and category != 'cpu'):
            continue
        key = profile(category, title)
        if EXCLUDED.search(title) or not compatible(category, target, key):
            rejected += 1
            continue
        if category == 'cpu':
            chip = r'(?<!\d)(?:[789]\d{3}(?:X3D|X|F|G)?|(?:12|13|14)\d{3}(?:KF|K|F)?)\b'
            if one(chip, title.upper()) == one(chip, selected.modelName.upper()):
                continue
        # A seller title containing several recognised brands is a multi-SKU listing.
        if any(brand_key(alias) != vendor and re.search(
                (r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])') if alias.isascii() else re.escape(alias), title, re.I)
               for _, aliases in BRANDS for alias in aliases if len(alias) >= 2):
            rejected += 1
            continue
        try:
            observed = datetime.fromisoformat(row['collected_at'].replace('Z', '+00:00'))
            if observed.tzinfo is None: observed = observed.replace(tzinfo=timezone.utc)
        except ValueError: continue
        url = safe_url(row['product_url']) if row['platform'] == 'taobao' else row['product_url']
        if not url or (row['platform'] == 'jd' and (urlsplit(url).hostname != 'item.jd.com' or urlsplit(url).scheme not in ('https', 'http'))): continue
        if not row['price_cents'] or row['price_cents'] <= 0 or observed < cutoff: continue
        merchant = merchant_identity(row['platform'], row['shop'], raw)
        if not merchant['merchantEligible']: continue
        known = next((part for part in catalog if part.category == category and matches(category, part.brand, part.modelName, part.specs, dict(name=title, brand=row['brand']))), None)
        if known: continue  # Already in the standard catalog; exact quote lookup handles it.
        # One evidence-backed listing per brand/profile. Do not create duplicates from shops.
        identity = vendor if category != 'cpu' else title
        identifier = hashlib.sha256((category + vendor + title).encode()).hexdigest()[:24]
        specifications = title
        if category == 'gpu': specifications = f'{key[0]} · {key[1]}GB · 尺寸及供电接口待核验'
        if category == 'board': specifications = ' · '.join(key)
        if category == 'ram': specifications = f'{key[1] // key[3]}GB × {key[3]} · {key[0]}' + (f' · {key[2]}MT/s' if key[2] else ' · 频率待核验')
        if category == 'ssd': specifications = f'{key[0]}GB · M.2 NVMe · PCIe {key[1]}.0'
        if category == 'cpu': specifications = f'{key[1]} · 参数待核验'
        display_name = f'{row["brand"]} {key[1]}GB {title}' if category == 'ram' else title
        option = dict(id='discovered-' + identifier, brand=row['brand'], name=display_name[:200], specs=specifications,
                      price=row['price_cents'] / 100, tag='采集展示价 · 标题规格待核验',
                      marketOffer=dict(id=row['id'], shop=row['shop'], platform=row['platform'], productUrl=url, collectedAt=row['collected_at']))
        if category == 'power': option['psuWatts'] = key[0]
        rank = (not merchant['isJdSelfOperated'], option['price'])
        if identity not in found or rank < found[identity][0]: found[identity] = (rank, option)
    return [item[1] for item in sorted(found.values(), key=lambda item: item[0])][:24], rejected


def discover_candidates(state, selected, catalog, collect):
    target = profile(selected.category, selected.modelName + ' ' + selected.specs)
    if not target:
        return dict(options=[], summary='当前规格资料不完整，无法可靠自动扩展；已有标准候选仍可使用。', collection='insufficient_specs', errors=[])
    options, rejected = find_candidates(state, selected, catalog)
    references = find_reference_candidates(state, selected, catalog)
    errors, status = [], 'database'
    query = keyword(selected.category, target)
    # A shared lock reserves the cooldown before network I/O, including concurrent requests.
    if not hasattr(state, 'candidate_collection_lock'):
        state.candidate_collection_lock = threading.Lock()
        state.candidate_collection_attempts = {}
    with state.candidate_collection_lock:
        last = state.candidate_collection_attempts.get(query, 0)
        permitted = collect and time.monotonic() - last >= 600
        if permitted: state.candidate_collection_attempts[query] = time.monotonic()
    if collect and not permitted: status = 'cooldown'
    if permitted:
        feed = refresh_references(state.database, selected.category)
        if feed['status'] in ('source_unavailable', 'empty_source'):
            errors.append('整类公开报价源暂不可用，保留已有参考记录')
        references = find_reference_candidates(state, selected, catalog)
        configured = False
        for platform in ('jd', 'taobao'):
            client = state.jd_client if platform == 'jd' else state.taobao_client
            if not (client.configured if platform == 'jd' else client.search_configured): continue
            configured = True
            try:
                if platform == 'jd': JDSearchService(state.database, client).search(query, 1, 50)
                else: state.taobao_search.search(query, 1, 40)
            except (JDError, TaobaoError) as error:
                code = re.sub(r'[^a-zA-Z0-9_.-]', '', str(error.code))[:40]
                errors.append(platform + '采集不可用' + (f' [{code}]' if code else ''))
        options, rejected = find_candidates(state, selected, catalog)
        status = 'collected' if configured else 'not_configured'
    merged = {item['id']: item for item in references}
    merged.update({item['id']: item for item in options})
    return dict(options=list(merged.values()), summary=f'按规格查询全部品牌：{len(options)} 个采集商品、{len(references)} 个渠道参考型号；{rejected} 条规格不明或不匹配商品未采用。', collection=status, errors=errors)
