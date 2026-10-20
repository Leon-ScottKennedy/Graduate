import tempfile
import unittest
import os
from unittest.mock import patch
from pathlib import Path
from urllib.parse import parse_qs
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.integrations.taobao import TaobaoClient, TaobaoError, sign, SEARCH_METHOD
from app.ingestion.taobao_search import TaobaoSearchService, clean_search_item, safe_url


def goods(identifier='new-opaque_123', price='3599.00'):
    return dict(item_id=identifier, item_basic_info=dict(title='<b>微星 RTX 4070 SUPER</b>', shop_title='测试店铺', brand_name='MSI', category_name='显卡'),
                price_promotion_info=dict(zk_final_price=price, reserve_price='3999', final_promotion_price='3499'),
                publish_info=dict(click_url='https://s.click.taobao.com/test'))


class TaobaoSearchTests(unittest.TestCase):
    def test_existing_database_migration_preserves_saved_search(self):
        database = self.client.app.state.database
        with database.connect() as db:
            db.execute("INSERT INTO ingestion_tasks VALUES('legacy','taobao','completed','2026-10-20',NULL)")
            db.execute("INSERT INTO taobao_searches(task_id,keyword,page,page_size) VALUES('legacy','AMD 7700',1,20)")
            db.execute('ALTER TABLE taobao_searches DROP COLUMN tmall_only')
        database.initialize()
        with database.connect() as db:
            row = db.execute("SELECT keyword,tmall_only FROM taobao_searches WHERE task_id='legacy'").fetchone()
            self.assertEqual(row['keyword'], 'AMD 7700')
            self.assertEqual(row['tmall_only'], 0)

    def test_tmall_scope_has_separate_cache(self):
        service = self.mock([goods()])
        data = service.search('RTX 4070', tmall_only=True)
        self.assertIsNone(service.cached('RTX 4070'))
        self.assertEqual(service.cached('RTX 4070', tmall_only=True)['taskId'], data['taskId'])

    def test_platform_no_results_is_cached_success_not_failure_cooldown(self):
        calls = []
        def handler(request):
            calls.append(request)
            params = parse_qs(request.content.decode())
            self.assertEqual(params['is_tmall'], ['true'])
            return httpx.Response(200, json={'error_response': {'code': 15, 'sub_code': '50001', 'sub_msg': '无结果'}})
        service = TaobaoSearchService(self.client.app.state.database, TaobaoClient(self.settings, httpx.MockTransport(handler)))
        first = service.search('AMD 7700', tmall_only=True)
        self.assertEqual(first['status'], 'completed')
        self.assertEqual(first['products'], [])
        self.assertEqual(service.search('AMD 7700', tmall_only=True)['taskId'], first['taskId'])
        self.assertEqual(len(calls), 1)

    def test_full_pid_normalized_without_exposing_configuration(self):
        for value in ['mm_111_222_123456', '123456']:
            with patch.dict(os.environ, {'TAOBAO_ADZONE_ID': value}), patch('app.config.load_dotenv'):
                settings = Settings.from_environment()
                self.assertEqual(settings.taobao_adzone_id, '123456')
                self.assertNotIn('123456', repr(settings))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name)/'test.sqlite', taobao_app_key='test-key', taobao_app_secret='test-secret', taobao_adzone_id='123456')
        self.client = TestClient(create_app(self.settings))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def mock(self, items, total=None):
        def handler(request):
            self.assertEqual(str(request.url), 'https://eco.taobao.com/router/rest')
            params = {key: values[0] for key, values in parse_qs(request.content.decode()).items()}
            self.assertEqual(params['method'], SEARCH_METHOD)
            self.assertEqual(params['adzone_id'], '123456')
            self.assertEqual(params['biz_scene_id'], '1')
            self.assertEqual(params['sign'], sign(params, 'test-secret'))
            return httpx.Response(200, json={'tbk_dg_material_optional_upgrade_response': {'total_results': len(items) if total is None else total, 'result_list': {'map_data': items}}})
        service = TaobaoSearchService(self.client.app.state.database, TaobaoClient(self.settings, httpx.MockTransport(handler)))
        self.client.app.state.taobao_search = service
        return service

    def test_cleaning_price_bases_and_safe_links(self):
        result = clean_search_item(goods())
        self.assertEqual(result['title'], '微星 RTX 4070 SUPER')
        self.assertEqual(result['discountPriceCents'], 359900)
        self.assertEqual(result['estimatedPriceCents'], 349900)
        self.assertFalse(result['skuVerified'])
        self.assertIsNone(clean_search_item(goods(price='NaN'))['discountPriceCents'])
        self.assertFalse(clean_search_item({**goods(), 'presale_info': {'presale_deposit': '0.00', 'presale_start_time': '0'}})['presale'])
        self.assertIsNone(safe_url('javascript:alert(1)'))
        self.assertIsNone(safe_url('https://s.click.taobao.com.evil.test/a'))
        self.assertIsNone(safe_url('https://user:pass@item.taobao.com/a'))

    def test_search_persists_and_cached_does_not_call_remote(self):
        self.mock([goods(), goods(), {'invalid': True}, goods(identifier=None)])
        response = self.client.post('/api/taobao/search', json={'keyword': 'RTX 4070 SUPER'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['received'], 4)
        self.assertEqual(data['valid'], 2)
        self.assertEqual(data['excluded'], 2)
        self.assertEqual(data['products'][0]['itemId'], 'new-opaque_123')
        cached = self.client.get('/api/taobao/search?keyword=RTX%204070%20SUPER').json()
        self.assertEqual(cached['taskId'], data['taskId'])
        with self.client.app.state.database.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM products WHERE platform='taobao'").fetchone()[0], 1)
            self.assertIsNone(db.execute('SELECT hardware_id FROM products').fetchone()[0])
            self.assertEqual(db.execute('SELECT price_cents FROM price_snapshots').fetchone()[0], 359900)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM manual_quotes').fetchone()[0], 0)

    def test_missing_configuration_and_bad_requests(self):
        client = TaobaoClient(Settings(Path('unused')))
        self.assertFalse(client.search_configured)
        with self.assertRaises(TaobaoError): client.search('RTX 4070')
        for body in [{'keyword': 'https://item.taobao.com/?id=123'}, {'keyword': 'x'}, {'keyword': 'CPU', 'page': 0}, {'keyword': 'CPU', 'adzone_id': 'fake'}]:
            self.assertEqual(self.client.post('/api/taobao/search', json=body).status_code, 422)

    def test_errors_do_not_fake_empty_success_or_echo_key(self):
        def handler(request):
            return httpx.Response(200, json={'error_response': {'code': 11, 'msg': 'test-secret denied test-key'}})
        self.client.app.state.taobao_search = TaobaoSearchService(self.client.app.state.database, TaobaoClient(self.settings, httpx.MockTransport(handler)))
        response = self.client.post('/api/taobao/search', json={'keyword': 'RTX 4070'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('test-secret', response.text)
        self.assertNotIn('test-key', response.text)
        self.assertIsNone(self.client.get('/api/taobao/search?keyword=RTX%204070').json())
        with self.client.app.state.database.connect() as db:
            self.assertEqual(db.execute('SELECT status FROM ingestion_tasks').fetchone()[0], 'failed')

    def test_permission_rejection_retains_safe_request_id(self):
        def handler(request):
            return httpx.Response(200, json={'error_response': {'code': 11, 'sub_code': 'isv.permission-api-package-limit', 'sub_msg': 'scope ids is 16189 16516', 'request_id': 'req-test-123'}})
        with self.assertRaises(TaobaoError) as caught:
            TaobaoClient(self.settings, httpx.MockTransport(handler)).search('RTX 4070')
        self.assertEqual(caught.exception.request_id, 'req-test-123')
        self.assertEqual(caught.exception.sub_code, 'isv.permission-api-package-limit')

    def test_invalid_latest_price_and_presale_never_used_as_valid_price(self):
        self.mock([goods()])
        self.client.post('/api/taobao/search', json={'keyword': 'RTX 4070'})
        presale = {**goods(price='100'), 'presale_info': {'presale_deposit': '100'}}
        self.mock([presale])
        self.client.app.state.taobao_search.CACHE_SECONDS = 0
        self.client.app.state.taobao_search.MIN_INTERVAL_SECONDS = 0
        self.client.post('/api/taobao/search', json={'keyword': 'RTX 4070'})
        with self.client.app.state.database.connect() as db:
            rows = db.execute('SELECT price_cents FROM price_snapshots ORDER BY id DESC').fetchall()
            self.assertIsNone(rows[0][0])
            self.assertEqual(rows[1][0], 359900)

    def test_cache_and_cross_instance_rate_limit(self):
        service = self.mock([goods()])
        first = service.search('RTX 4070')
        other = TaobaoSearchService(service.database, service.client)
        self.assertEqual(other.search('RTX 4070')['taskId'], first['taskId'])
        with self.assertRaises(TaobaoError):
            other.search('RTX 5070')

    def test_failed_request_cools_down_and_daily_limit(self):
        service = self.mock([goods()])
        with patch.object(service.client, 'search', side_effect=TaobaoError('denied')) as remote:
            with self.assertRaises(TaobaoError):
                service.search('RTX 4070')
            with self.assertRaises(TaobaoError):
                TaobaoSearchService(service.database, service.client).search('RTX 5070')
            self.assertEqual(remote.call_count, 1)
        service.FAILURE_COOLDOWN_SECONDS = 0
        service.DAILY_LIMIT = 1
        with patch.object(service.client, 'search') as remote:
            with self.assertRaises(TaobaoError):
                service.search('RTX 5070')
            remote.assert_not_called()
