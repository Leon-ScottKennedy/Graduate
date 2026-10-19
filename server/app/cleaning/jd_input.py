import re
from urllib.parse import parse_qs, urlsplit


def parse_sku_inputs(value: str) -> list[str]:
    tokens = re.split(r'[\s,，;；]+', value.strip())
    result = []
    for token in tokens:
        if re.fullmatch(r'[0-9]{1,40}', token):
            sku = token
        else:
            try:
                url = urlsplit(token)
                if (url.scheme not in ('http', 'https') or url.username or url.password
                        or url.port not in (None, 80, 443)
                        or url.hostname not in ('item.jd.com', 'item.m.jd.com', 'mitem.jd.com')):
                    raise ValueError()
                path = re.fullmatch(r'/(?:product/)?([0-9]{1,40})\.html', url.path)
                sku = path[1] if path else ''
                if not sku and url.hostname == 'item.m.jd.com' and url.path == '/ware/view.action':
                    sku = parse_qs(url.query).get('wareId', [''])[0]
                if not re.fullmatch(r'[0-9]{1,40}', sku):
                    raise ValueError()
            except ValueError:
                raise ValueError('请输入京东商品完整链接或纯数字 SKU；不支持短链接和其他网站。') from None
        if int(sku) == 0:
            raise ValueError('SKU 必须为大于零的商品编号。')
        sku = str(int(sku))
        if sku not in result:
            result.append(sku)
    if not 1 <= len(result) <= 10:
        raise ValueError('每次可查询 1 至 10 个不同的商品 SKU。')
    return result
