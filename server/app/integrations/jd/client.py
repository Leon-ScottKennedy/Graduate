import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from ...config import Settings

METHOD = "jd.union.open.goods.query"
DETAIL_METHOD = "jd.union.open.goods.promotiongoodsinfo.query"
POOL_METHOD = "jd.union.open.goods.jingfen.query"
BIGFIELD_METHOD = "jd.union.open.goods.bigfield.query"
GATEWAY = "https://api.jd.com/routerjson"


class JDError(Exception):
    def __init__(self, message: str, status: int = 502, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code if code and re.fullmatch(r"[\w.-]{1,50}", str(code)) else None


@dataclass
class JDPage:
    items: list[dict]
    total_count: int
    raw_response: str


def sign_parameters(parameters: dict[str, str], secret: str) -> str:
    ordered = ''.join(key + value for key, value in sorted(parameters.items()) if key != 'sign' and value)
    return hashlib.md5((secret + ordered + secret).encode('utf-8')).hexdigest().upper()


def parse_response(text: str, method: str = METHOD) -> JDPage:
    try:
        payload = json.loads(text)
        if not isinstance(payload, dict):
            raise ValueError()
        error = payload.get('error_response')
        if error:
            if str(error.get('code')) == '67':
                raise JDError('京东网关返回后端服务异常，需核对接口参数或稍后重试。', code='67')
            raise JDError('京东拒绝了请求，请检查接口权限和密钥。', code=str(error.get('code', 'unknown')))
        prefix = method.replace('.', '_')
        envelope = payload.get(prefix + '_responce') or payload.get(prefix + '_response')
        if not isinstance(envelope, dict):
            raise ValueError()
        if str(envelope.get('code', '0')) != '0':
            raise JDError('京东接口调用失败，请核对接口权限。', code=str(envelope.get('code')))
        result = envelope.get('queryResult')
        result = json.loads(result) if isinstance(result, str) else result
        if not isinstance(result, dict) or 'code' not in result:
            raise ValueError()
        if str(result['code']) != '200':
            if method == DETAIL_METHOD:
                if str(result['code']) in ('403', '440'):
                    raise JDError('京东拒绝了商品信息查询。请确认本地 appkey 对应的应用及接口权限。', code=str(result['code']))
                if str(result['code']) == '441':
                    raise JDError('京东提示查询场景与商品编号格式不匹配，请核对 SKU 与接口文档。', code='441')
            if str(result['code']) == '403':
                raise JDError('当前应用没有京东商品搜索接口的访问权限，请在京东联盟确认 jd.union.open.goods.query 是否已开通。', code='403')
            raise JDError('京东商品查询失败，请核对接口权限及查询条件。', code=str(result['code']))
        items = result.get('data')
        if items is None:
            items = []
        if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
            raise ValueError()
        total_count = int(result.get('totalCount', len(items)))
        return JDPage(items, max(total_count, 0), text)
    except (ValueError, TypeError, AttributeError) as exc:
        raise JDError('京东返回的数据格式与预期不符，需要核对接口文档。') from exc


class JDClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self):
        return bool(self.settings.jd_app_key.strip() and self.settings.jd_app_secret.strip())

    def search(self, keyword: str, page: int, page_size: int) -> JDPage:
        return self._request(METHOD, {'goodsReqDTO': {
            'keyword': keyword, 'pageIndex': page, 'pageSize': page_size,
        }})

    def details(self, sku_ids: list[str]) -> JDPage:
        # Basic product information accepts comma-separated normal SKU IDs.
        # Big-field sceneId=2 requires separate permission and is not used here.
        if not 1 <= len(sku_ids) <= 10 or any(not re.fullmatch(r'[0-9]{1,40}', sku) for sku in sku_ids):
            raise JDError('请提供 1 至 10 个有效的京东 SKU。', status=422)
        return self._request(DETAIL_METHOD, {'skuIds': ','.join(sku_ids)})

    def pool(self, elite_id: int = 24, page: int = 1, page_size: int = 50) -> JDPage:
        return self._request(POOL_METHOD, {'goodsReq': {
            'eliteId': elite_id, 'pageIndex': page, 'pageSize': page_size,
        }})

    def item_details(self, item_ids: list[str]) -> JDPage:
        if not 1 <= len(item_ids) <= 10 or any(not re.fullmatch(r'[A-Za-z0-9_-]{1,200}', item) for item in item_ids):
            raise JDError('请提供 1 至 10 个有效的 itemId。', status=422)
        return self._request(BIGFIELD_METHOD, {'goodsReq': {'sceneId': 1, 'itemIds': item_ids}})

    def _request(self, method: str, business: dict) -> JDPage:
        if not self.configured:
            raise JDError('请先在 server/.env 填写 JD_APP_KEY 和 JD_APP_SECRET。', status=503)
        parameters = {
            'method': method, 'app_key': self.settings.jd_app_key, 'format': 'json',
            'v': '1.0', 'sign_method': 'md5',
            'timestamp': datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S'),
            '360buy_param_json': json.dumps(business, ensure_ascii=False, separators=(',', ':')),
        }
        parameters['sign'] = sign_parameters(parameters, self.settings.jd_app_secret)
        try:
            # Form POST keeps credentials and signatures out of URLs/access logs.
            with httpx.Client(timeout=20, follow_redirects=False) as client:
                response = client.post(GATEWAY, data=parameters)
                response.raise_for_status()
                if len(response.content) > 5_000_000:
                    raise JDError('京东响应过大，请缩小查询范围。')
                return parse_response(response.text, method)
        except httpx.TimeoutException as exc:
            raise JDError('京东请求超时，请稍后重试。', status=504) from exc
        except httpx.HTTPError as exc:
            # Never propagate exceptions that may contain request headers or credentials.
            raise JDError('无法连接京东接口，请检查网络或稍后重试。') from exc
