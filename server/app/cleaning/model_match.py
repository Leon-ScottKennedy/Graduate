"""Conservative title matching. Missing or ambiguous identity is never a quote."""
import re
import unicodedata
from .jd_goods import clean_text

BRANDS = [
    ('amd', ['amd']), ('asus', ['华硕', 'asus']), ('msi', ['微星', 'msi']),
    ('gigabyte', ['技嘉', 'gigabyte']), ('kingston', ['金士顿', 'kingston']),
    ('wd', ['西部数据', 'western digital', 'wd']), ('samsung', ['三星', 'samsung']),
    ('corsair', ['美商海盗船', '海盗船', 'corsair']), ('deepcool', ['九州风神', 'deepcool']),
    ('thermalright', ['利民', 'thermalright']), ('asrock', ['华擎', 'asrock']),
    ('sapphire', ['蓝宝石', 'sapphire']), ('gskill', ['芝奇', 'g.skill', 'gskill']),
    ('huntkey', ['航嘉', 'huntkey']), ('sama', ['先马', 'sama']),
    ('lianli', ['联力', 'lian li', 'lianli']), ('galax', ['影驰', 'galax']),
]


def fold(value):
    return re.sub(r'[\W_]+', '', unicodedata.normalize('NFKC', clean_text(value)).casefold())


def brand_key(value):
    text = fold(value)
    for canonical, aliases in BRANDS:
        if any(fold(alias) in text for alias in aliases):
            return canonical
    return text


def model_key(name, brand):
    text = unicodedata.normalize('NFKC', clean_text(name)).casefold()
    for canonical, aliases in BRANDS:
        if canonical == brand_key(brand):
            for alias in sorted(aliases, key=len, reverse=True):
                text = re.sub(re.escape(alias), '', text, flags=re.I)
    text = text.replace(clean_text(brand).casefold(), '')
    # Edition attributes are checked separately; their word order may vary.
    text = re.sub(r'(?<![a-z])(?:argb|rgb|wi[ -]?fi|oc|v2|v3)(?![a-z])|白色|黑色|白款|黑款|盒装|散片', '', text)
    text = re.sub(r'(\d+)\s*g(?:b)?(?![a-z])', r'\1gb', text)
    text = re.sub(r'套装|台式机|固态硬盘|独立显卡|显卡|处理器|主板|内存|电源|机箱|散热器', '', text)
    return fold(text)


def flags(text):
    text = unicodedata.normalize('NFKC', text).casefold()
    result = set()
    for flag, pattern in {
        'white': r'白色|白款|white', 'black': r'黑色|黑款|black edition',
        'v2': r'(?<![a-z0-9])v2(?![a-z0-9])|二代|第二代', 'v3': r'(?<![a-z0-9])v3(?![a-z0-9])|三代',
        'wifi': r'wi[ -]?fi', 'argb': r'argb', 'rgb': r'(?<!a)rgb',
        'box': r'盒装', 'tray': r'散片', 'oc': r'(?<![a-z])oc(?![a-z])',
    }.items():
        if re.search(pattern, text):
            result.add(flag)
    return result


def capacities(text):
    text = unicodedata.normalize('NFKC', text).casefold()
    amounts = {float(number) * (1024 if unit == 'tb' else 1)
               for number, unit in re.findall(r'(\d+(?:\.\d+)?)\s*(tb|gb|g)(?![a-z])', text)}
    # A kit may expose both total and per-module capacities.
    for number, modules in re.findall(r'(\d+)\s*g(?:b)?\s*[x×*]\s*(\d+)', text):
        amounts.discard(float(number))
        amounts.add(float(number) * int(modules))
    return amounts


def matches(category, brand, name, specs, product):
    if not clean_text(product.get('brand')) or brand_key(brand) != brand_key(product['brand']):
        return False
    title = clean_text(product.get('name'))
    if re.search(r'二手|拆机|翻新|维修|定金|补差|差价|租赁|空盒|包装盒|套餐', title):
        return False
    if category != 'ram' and '套装' in title:
        return False
    target_key = model_key(name, brand)
    source_key = model_key(title, brand)
    if len(target_key) < 3:
        return False
    if category == 'cpu':
        chips = re.findall(r'(?<![a-z0-9])(\d{4}[a-z0-9]*)(?![a-z0-9])', name.casefold())
        candidate_chips = re.findall(r'(?<![a-z0-9])(\d{4}[a-z0-9]*)(?![a-z0-9])', title.casefold())
        if len(chips) != 1 or set(candidate_chips) != set(chips):
            return False
    elif not re.search(re.escape(target_key) + r'(?=\d+(?:gb|tb|w)|[^a-z0-9]|$)', source_key):
        return False
    if flags(name) != flags(title):
        return False
    if category in ('ram', 'ssd', 'gpu'):
        target_capacity = capacities(name) or capacities(specs)
        if len(target_capacity) != 1 or capacities(title) != target_capacity:
            return False
    if category == 'ram':
        target_ddr = set(re.findall(r'ddr\s*([345])', name + ' ' + specs, re.I))
        if len(target_ddr) != 1 or set(re.findall(r'ddr\s*([345])', title, re.I)) != target_ddr:
            return False
        frequency = re.search(r'ddr\s*[345]\s*[- ]?\s*(\d{4,5})|(\d{4,5})\s*(?:mt/s|mhz)', name + ' ' + specs, re.I)
        if frequency and not re.search(r'(?<!\d)' + next(value for value in frequency.groups() if value) + r'(?!\d)', title):
            return False
    if category == 'power':
        watts = re.search(r'(\d+)\s*w', specs, re.I)
        source_watts = set(re.findall(r'(\d+)\s*w(?![a-z])', title, re.I))
        if not watts or (source_watts and source_watts != {watts[1]}):
            return False
    return True
