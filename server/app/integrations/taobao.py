"""Taobao Union item-level information; never interpret as a selected SKU quote."""
import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit, parse_qs
import httpx
from ..cleaning.jd_goods import clean_text

METHOD = 'taobao.tbk.item.info.get'
SEARCH_METHOD = 'taobao.tbk.dg.material.optional.upgrade'
GATEWAY = 'https://eco.taobao.com/router/rest'
IDENTIFIER = r'[A-Za-z0-9_-]{1,256}'


class TaobaoError(Exception):
    def __init__(self, message, code='', sub_code='', request_id=''):
        super().__init__(message)
        self.code = code
        self.sub_code = sub_code
        self.request_id = request_id


def parse_item(value):
    if re.fullmatch(IDENTIFIER, value):
        return {'itemId': value, 'skuId': None, 'sourceUrl': None}
    url = urlsplit(value)
    if url.scheme != 'https' or url.hostname not in ('detail.tmall.com', 'item.taobao.com') or url.username or url.password or url.port not in (None, 443):
        raise ValueError('请提供淘宝/天猫完整 HTTPS 商品链接或商品 ID')
    query = parse_qs(url.query)
    ids = query.get('id', [])
    if len(ids) != 1 or not re.fullmatch(IDENTIFIER, ids[0]):
        raise ValueError('链接缺少唯一有效商品 ID')
    skus = query.get('skuId', [])
    if len(skus) > 1 or (skus and not re.fullmatch(r'[0-9]{1,30}', skus[0])):
        raise ValueError('链接中的 SKU ID 无效')
    return {'itemId': ids[0], 'skuId': skus[0] if skus else None, 'sourceUrl': value}


def sign(parameters, secret):
    text = ''.join(key + str(value) for key, value in sorted(parameters.items()) if key != 'sign' and value is not None)
    return hashlib.md5((secret + text + secret).encode()).hexdigest().upper()


def money(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0 or amount * 100 != (amount * 100).to_integral_value():
            return None
        return int(amount * 100)
    except (InvalidOperation, ValueError):
        return None


def clean_item(item):
    # Keep price bases separate. None is never replaced by coupon/activity/deposit price.
    identifier = str(item.get('num_iid') or item.get('input_num_iid') or '')
    title = clean_text(item.get('title'))
    if not identifier or not title:
        raise ValueError('商品缺少标识或标题')
    return dict(itemId=identifier, inputItemId=str(item.get('input_num_iid') or ''),
                title=title, shop=clean_text(item.get('nick')), sellerId=str(item.get('seller_id') or ''),
                category=clean_text(item.get('cat_leaf_name') or item.get('cat_name')),
                reservePriceCents=money(item.get('reserve_price')),
                discountPriceCents=money(item.get('zk_final_price')),
                activityPriceCents=money(item.get('sale_price')),
                priceScope='item', skuVerified=False, matchStatus='unverified',
                presale=any(item.get(key) for key in ('presale_deposit', 'presale_start_time', 'presale_end_time')))


class TaobaoClient:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.transport = transport

    @property
    def search_configured(self):
        return bool(self.settings.taobao_app_key and self.settings.taobao_app_secret
                    and re.fullmatch(r'[1-9][0-9]{0,19}', self.settings.taobao_adzone_id))

    def search(self, keyword, page=1, page_size=20):
        if not self.search_configured:
            raise TaobaoError('请在 server/.env 配置 TAOBAO_APP_KEY、TAOBAO_APP_SECRET 和 TAOBAO_ADZONE_ID（自己的推广位 PID 最后一段），然后重启后端')
        keyword = clean_text(keyword)
        if not 2 <= len(keyword) <= 120 or '://' in keyword:
            raise ValueError('请输入 2 至 120 字的硬件型号关键词，不要填商品链接')
        if not 1 <= page <= 100 or not 1 <= page_size <= 40:
            raise ValueError('分页范围无效')
        params = dict(q=keyword, adzone_id=self.settings.taobao_adzone_id,
                      page_no=str(page), page_size=str(page_size), biz_scene_id='1')
        payload = self.request(SEARCH_METHOD, params)
        envelope = payload.get('tbk_dg_material_optional_upgrade_response')
        if not isinstance(envelope, dict):
            raise TaobaoError('淘宝搜索响应结构异常')
        try:
            total = int(envelope.get('total_results', 0))
            result = envelope.get('result_list', {})
            if total and ('result_list' not in envelope or isinstance(result, dict) and 'map_data' not in result):
                raise ValueError('Missing nonempty result list')
            items = result.get('map_data', []) if isinstance(result, dict) else result
            if items is None and total == 0:
                items = []
            if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
                raise ValueError('Invalid items')
            if total < 0 or len(items) > 100:
                raise ValueError('Invalid count')
            return dict(items=items, total=total, payload=payload)
        except (TypeError, ValueError):
            raise TaobaoError('淘宝搜索列表格式异常') from None

    def request(self, method, business):
        parameters = dict(method=method, app_key=self.settings.taobao_app_key,
                          timestamp=datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S'),
                          v='2.0', sign_method='md5', format='json', simplify='false', **business)
        parameters['sign'] = sign(parameters, self.settings.taobao_app_secret)
        try:
            with httpx.Client(transport=self.transport, timeout=25, follow_redirects=False, trust_env=False) as client:
                response = client.post(GATEWAY, data=parameters)
                response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise TaobaoError('淘宝响应结构异常')
            if 'error_response' in payload:
                error = payload['error_response']
                code = clean_text(error.get('code'))[:50]
                sub = clean_text(error.get('sub_code'))[:100]
                message = clean_text(error.get('sub_msg') or error.get('msg'))[:300]
                for secret in (self.settings.taobao_app_key, self.settings.taobao_app_secret, parameters['sign'], self.settings.taobao_adzone_id):
                    if secret:
                        message = message.replace(secret, '[redacted]')
                message = re.sub(r'[a-fA-F0-9]{32,}', '[redacted]', message)[:160]
                request_id = clean_text(error.get('request_id'))
                request_id = request_id if re.fullmatch(r'[A-Za-z0-9_-]{1,150}', request_id) else ''
                if sub == 'isv.permission-api-package-limit':
                    message = '平台拒绝访问当前具体 API，请核对已获权限包内的 API 列表或向平台反馈。' + message
                raise TaobaoError(f'淘宝接口拒绝请求（{code}{":" + sub if sub else ""}）：{message}', code, sub, request_id)
            return payload
        except (httpx.HTTPError, json.JSONDecodeError, TypeError, AttributeError):
            raise TaobaoError('淘宝请求失败或响应无效，请检查网络及接口配置') from None

    def details(self, identifiers, scene='2'):
        if not self.settings.taobao_app_key or not self.settings.taobao_app_secret:
            raise TaobaoError('请在 server/.env 填写 TAOBAO_APP_KEY 和 TAOBAO_APP_SECRET')
        if not 1 <= len(identifiers) <= 40 or any(not re.fullmatch(IDENTIFIER, value) for value in identifiers):
            raise ValueError('一次支持 1 至 40 个有效商品 ID')
        if scene not in ('1', '2'):
            raise ValueError('仅支持文档中的场景 1 或 2')
        if scene == '2' and any(not value.isascii() or not value.isdigit() for value in identifiers):
            raise ValueError('消费者比价场景 2 只接受数字商品 ID；新商品 ID 请使用场景 1')
        parameters = dict(method=METHOD, app_key=self.settings.taobao_app_key,
                          timestamp=datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S'),
                          v='2.0', sign_method='md5', format='json',
                          num_iids=','.join(dict.fromkeys(identifiers)), platform='1', biz_scene_id=scene)
        parameters['sign'] = sign(parameters, self.settings.taobao_app_secret)
        try:
            with httpx.Client(transport=self.transport, timeout=20, follow_redirects=False) as client:
                response = client.post(GATEWAY, data=parameters)
                response.raise_for_status()
            payload = response.json()
            if 'error_response' in payload:
                error = payload['error_response']
                code = str(error.get('code', 'unknown'))
                safe_code = code if re.fullmatch(r'[\w.-]{1,50}', code) else 'unknown'
                sub_code = str(error.get('sub_code') or '')
                safe_sub = sub_code if re.fullmatch(r'[a-zA-Z0-9_.-]{1,100}', sub_code) else ''
                message = clean_text(error.get('sub_msg') or error.get('msg') or '')
                for sensitive in (self.settings.taobao_app_key, self.settings.taobao_app_secret, parameters['sign']):
                    message = message.replace(sensitive, '[redacted]')
                message = re.sub(r'[a-fA-F0-9]{32,}', '[redacted]', message)[:160]
                raise TaobaoError(f'淘宝接口拒绝请求（{safe_code}{":" + safe_sub if safe_sub else ""}）：{message}')
            envelope = payload.get('tbk_item_info_get_response')
            if not isinstance(envelope, dict) or not isinstance(envelope.get('results'), dict):
                raise TaobaoError('淘宝返回格式异常，需要核对接口文档')
            items = envelope['results'].get('n_tbk_item', [])
            if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
                raise TaobaoError('淘宝商品列表格式异常')
            return items
        except (httpx.HTTPError, json.JSONDecodeError, TypeError, AttributeError):
            raise TaobaoError('淘宝请求失败或响应无效，请检查网络及接口配置') from None
