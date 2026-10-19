"""Read-only official SDK cross-check: nested ZIP, signatures, and detail variants.

Uses the inspected SDK's pure signing utility without installing its obsolete pinned
HTTP dependencies. HTTP transport remains the project's httpx client. Never writes DB.
"""
import argparse
import ast
import json
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings
from app.integrations.taobao import GATEWAY, parse_item, sign

ROOT = Path(__file__).resolve().parents[2]
FILES = {
    'basic': ('taobao_tbk_item_info_get_request.py', {'num_iids', 'platform', 'biz_scene_id'}),
    'temporary': ('taobao_tbk_item_info_temporary_get_request.py', {'num_iids', 'platform'}),
    'upgrade': ('taobao_tbk_item_info_upgrade_get_request.py', {'item_id', 'biz_scene_id'}),
}


def read_sdk(path):
    with ZipFile(path) as outer:
        nested = [n for n in outer.namelist() if n.endswith('.zip') and 'taobao-sdk' in n]
        data = outer.read(nested[0]) if nested else None
    return ZipFile(BytesIO(data)) if data else ZipFile(path)


def contracts(sdk):
    result = {}
    for variant, (filename, fields) in FILES.items():
        path = 'topsdk/ability371/request/' + filename
        tree = ast.parse(sdk.read(path).decode('utf-8'))
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef))
        methods = {n.name: n for n in cls.body if isinstance(n, ast.FunctionDef)}
        actual = {arg.arg for arg in methods['__init__'].args.args} - {'self'}
        if not fields <= actual:
            raise ValueError('SDK request fields differ from inspected contract')
        returned = next(n for n in methods['get_api_name'].body if isinstance(n, ast.Return))
        result[variant] = ast.literal_eval(returned.value)
        expected = {'basic': 'taobao.tbk.item.info.get', 'temporary': 'taobao.tbk.item.info.temporary.get',
                    'upgrade': 'taobao.tbk.item.info.upgrade.get'}
        if result[variant] != expected[variant]:
            raise ValueError('Unexpected SDK API name; inspect before using')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk', required=True)
    parser.add_argument('--item', default='769696180391')
    parser.add_argument('--output', default=str(ROOT / '.tmp' / 'taobao-sdk-result.json'))
    args = parser.parse_args()
    identifier = parse_item(args.item)['itemId']
    settings = Settings.from_environment()
    if not settings.taobao_app_key or not settings.taobao_app_secret:
        raise SystemExit('Taobao credentials are not configured')
    with read_sdk(args.sdk) as sdk:
        methods = contracts(sdk)
        # The utility contains only pure stdlib conversion/signing helpers; inspected before use.
        utility = types.ModuleType('official_taobao_sdk_util')
        exec(compile(sdk.read('topsdk/util.py'), 'official_sdk/util.py', 'exec'), utility.__dict__)
    sample = {'method': methods['basic'], 'app_key': 'test-key', 'num_iids': '123', 'platform': '1'}
    assert sign(sample, 'test-secret') == utility.get_sign(sample.copy(), {}, 'test-secret', 'md5')
    print('Official SDK MD5 matches current implementation; request contracts verified.')
    results = []
    cases = [('basic', '1'), ('temporary', None), ('upgrade', '1'), ('upgrade', '2')]
    with httpx.Client(timeout=25, trust_env=False, follow_redirects=False) as client:
        for variant, scene in cases:
            params = dict(method=methods[variant], app_key=settings.taobao_app_key,
                          timestamp=datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S'),
                          v='2.0', format='json', simplify='false', sign_method='hmac-sha256')
            params['item_id' if variant == 'upgrade' else 'num_iids'] = identifier
            if variant != 'upgrade':
                params['platform'] = '1'
            if scene:
                params['biz_scene_id'] = scene
            params['sign'] = utility.get_sign(params.copy(), {}, settings.taobao_app_secret, params['sign_method'])
            record = dict(variant=variant, scene=scene, method=methods[variant])
            try:
                response = client.post(GATEWAY, data=params)
                payload = response.json()
                error = payload.get('error_response', {})
                record.update(httpStatus=response.status_code, code=error.get('code'), subCode=error.get('sub_code'),
                              message=error.get('sub_msg') or error.get('msg') or '')
                if not error and response.is_success:
                    record['response'] = payload
            except (httpx.HTTPError, ValueError):
                record['message'] = 'Network or invalid JSON response'
            text = json.dumps(record, ensure_ascii=True)
            for secret in (settings.taobao_app_key, settings.taobao_app_secret, params['sign']):
                text = text.replace(secret, '[redacted]')
            record = json.loads(text)
            results.append(record)
            print(json.dumps({k: v for k, v in record.items() if k != 'response'}, ensure_ascii=True))
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / '.tmp'):
        raise SystemExit('Probe output must stay in the ignored .tmp directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Read-only probe finished; database unchanged.')


if __name__ == '__main__':
    main()
