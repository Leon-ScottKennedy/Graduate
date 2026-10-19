"""Run the downloaded official SDK without installing or modifying it.

From repository root:
    server/.venv/Scripts/python.exe server/scripts/check_jd_sdk.py
    server/.venv/Scripts/python.exe server/scripts/check_jd_sdk.py --mode sku --sku 100180790616

Default: one pool query, then one big-field query using the returned itemId.
No database writes; credentials come from server/.env and are never printed.
"""
import argparse
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'server'))
from app.config import Settings


def business_result(payload, method):
    error = payload.get('error_response')
    if error:
        return {'code': error.get('code'), 'message': 'JD gateway rejected the request',
                'requestId': error.get('request_id')}
    prefix = method.replace('.', '_')
    envelope = payload.get(prefix + '_responce') or payload.get(prefix + '_response') or {}
    result = envelope.get('queryResult')
    result = json.loads(result) if isinstance(result, str) else result
    if not isinstance(result, dict):
        raise ValueError('Unexpected SDK response format')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk', type=Path, default=ROOT / 'jd-api-sdk-python3-20261017.zip')
    parser.add_argument('--mode', choices=['sku', 'pool', 'chain'], default='chain')
    parser.add_argument('--sku', default='100180790616')
    parser.add_argument('--elite-id', type=int, default=1)
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9]{1,40}', args.sku) or args.elite_id <= 0:
        parser.error('Invalid SKU or elite-id')
    with ZipFile(args.sdk) as archive:
        entries = [name for name in archive.namelist() if name.endswith('/jd/api/base.py')]
        if len(entries) != 1:
            raise ValueError('Cannot locate official SDK jd/api/base.py')
        prefix = entries[0][:-len('jd/api/base.py')]
    sys.path.insert(0, str(args.sdk.resolve()) + '/' + prefix.rstrip('/'))
    import jd
    from jd.api.rest.UnionOpenGoodsJingfenQueryRequest import UnionOpenGoodsJingfenQueryRequest, GoodsReq as PoolReq
    from jd.api.rest.UnionOpenGoodsBigfieldQueryRequest import UnionOpenGoodsBigfieldQueryRequest, GoodsReq as DetailReq
    from jd.api.rest.UnionOpenGoodsPromotiongoodsinfoQueryRequest import UnionOpenGoodsPromotiongoodsinfoQueryRequest

    settings = Settings.from_environment()
    if not settings.jd_app_key.strip() or not settings.jd_app_secret.strip():
        raise ValueError('Fill JD_APP_KEY and JD_APP_SECRET in server/.env first')
    jd.setDefaultAppInfo(settings.jd_app_key, settings.jd_app_secret)

    def call(request):
        # Preserve the SDK's signing, serialization, timestamp and version handling.
        result = business_result(request.getResponse(ssl=True, timeout=20), request.getapiname())
        items = result.get('data') or []
        summary = {'method': request.getapiname(), 'code': result.get('code'),
                   'message': result.get('message') or result.get('msg'),
                   'requestId': result.get('requestId'), 'count': len(items),
                   'items': [{key: item[key] for key in ('itemId', 'skuName', 'brandName', 'priceInfo')
                              if key in item} for item in items[:2]]}
        output = json.dumps(summary, ensure_ascii=True, indent=2)
        for sensitive in (settings.jd_app_key, settings.jd_app_secret):
            if sensitive:
                output = output.replace(sensitive, '[redacted]')
        print(output)
        return result

    # The SDK's legacy gw.api.360buy.com endpoint failed to connect in testing.
    domain = 'https://api.jd.com'
    if args.mode == 'sku':
        request = UnionOpenGoodsPromotiongoodsinfoQueryRequest(domain)
        request.skuIds = args.sku
        result = call(request)
    else:
        request = UnionOpenGoodsJingfenQueryRequest(domain)
        request.goodsReq = PoolReq()
        request.goodsReq.eliteId = args.elite_id
        request.goodsReq.pageIndex = 1
        request.goodsReq.pageSize = 1
        result = call(request)
        if args.mode == 'chain' and str(result.get('code')) == '200':
            item_id = next((item.get('itemId') for item in result.get('data', []) if item.get('itemId')), None)
            if not item_id:
                print('No itemId returned; detail query skipped.')
                return 1
            request = UnionOpenGoodsBigfieldQueryRequest(domain)
            request.goodsReq = DetailReq()
            request.goodsReq.sceneId = 1
            request.goodsReq.itemIds = [item_id]
            result = call(request)
    return 0 if str(result.get('code')) == '200' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        # SDK/transport exceptions can contain request data; only show the type.
        print(f'SDK check failed ({type(error).__name__}); no credentials printed.', file=sys.stderr)
        sys.exit(1)
