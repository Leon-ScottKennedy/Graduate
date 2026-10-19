import html
import re
import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit


def clean_text(value) -> str:
    if value is None or not isinstance(value, (str, int)) or isinstance(value, bool):
        return ''
    text = unicodedata.normalize('NFKC', html.unescape(str(value)))
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', text)).strip()


@dataclass
class CleanedGood:
    sku: str
    title: str
    brand: str
    shop: str
    price_cents: int
    product_url: str
    events: list[tuple[str, str, str]] = field(default_factory=list)


@dataclass
class CleaningResult:
    good: CleanedGood | None
    events: list[tuple[str, str, str]]


def detail_fields(item: dict) -> dict:
    # Retain the original nested item in raw_records; only adapt the cleaning view.
    base = item.get('baseGoodsInfo')
    if isinstance(base, dict):
        return {**base, 'skuId': base.get('skuId', item.get('skuId'))}
    # promotiongoodsinfo returns the displayed product price as unitPrice.
    return {**item, 'priceInfo': {'price': item.get('unitPrice')}}


def clean_good(item: dict, identity_key='skuId') -> CleaningResult:
    sku = clean_text(item.get(identity_key))
    title = clean_text(item.get('skuName'))
    pattern = r'[A-Za-z0-9_-]{1,200}' if identity_key == 'itemId' else r'[0-9]{1,40}'
    if not re.fullmatch(pattern, sku):
        return CleaningResult(None, [('sku_id', 'excluded', '商品 ID 缺失或无效')])
    if not title:
        return CleaningResult(None, [('title', 'excluded', '商品标题缺失或为空')])
    if re.search(r'定金|订金|补差|差价|空盒|包装盒|维修服务|回收服务|租赁', title):
        return CleaningResult(None, [('product_type', 'excluded', '定金、服务或非完整商品链接')])
    price_info = item.get('priceInfo')
    raw_price = price_info.get('price') if isinstance(price_info, dict) else None
    if raw_price is None or isinstance(raw_price, bool) or str(raw_price).strip() == '':
        return CleaningResult(None, [('price', 'excluded', '展示价缺失或为空')])
    try:
        amount = Decimal(str(raw_price).strip().replace(',', '').replace('¥', '').replace('￥', ''))
        cents = amount * 100
        if not amount.is_finite() or amount <= 0 or amount > 100_000_000 or cents != cents.to_integral_value():
            raise InvalidOperation()
        price_cents = int(cents)
    except (InvalidOperation, ValueError, OverflowError):
        return CleaningResult(None, [('price', 'excluded', '展示价无效、非正数或精度异常')])
    brand = clean_text(item.get('brandName'))
    shop_info = item.get('shopInfo')
    shop = clean_text(shop_info.get('shopName')) if isinstance(shop_info, dict) else ''
    events = [('model_match', 'review', '商品尚未确认型号匹配，需核对品牌、型号与版本')]
    if title != item.get('skuName'):
        events.append(('title', 'normalized', '清除 HTML、全角字符或多余空白'))
    if not brand:
        events.append(('brand', 'review', '品牌缺失，不从关键词推断品牌'))
    if not shop:
        events.append(('shop', 'review', '店铺信息缺失'))
    product_url = f'https://item.jd.com/{sku}.html'
    if identity_key == 'itemId':
        product_url = clean_text(item.get('materialUrl'))
        if product_url and not product_url.startswith(('http://', 'https://')):
            product_url = 'https://' + product_url
        try:
            parsed = urlsplit(product_url)
            if (parsed.scheme != 'https' or parsed.hostname not in ('jingfen.jd.com', 'item.jd.com', 'item.m.jd.com')
                    or parsed.username or parsed.password or parsed.port not in (None, 443)):
                raise ValueError()
        except ValueError:
            return CleaningResult(None, [('material_url', 'excluded', '商品链接缺失或不属于允许的京东 HTTPS 域名')])
    return CleaningResult(CleanedGood(
        sku, title, brand, shop, price_cents,
        product_url, events,
    ), events)
