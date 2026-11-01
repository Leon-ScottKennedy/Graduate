import asyncio
import dataclasses
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import AsyncMock
import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.repositories.database import Database
from app.security import SecurityMiddleware, SecurityStore


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name) / 'test.sqlite3',
            security_mode='production', access_code='visitor-access-' + 'v' * 32,
            admin_token='admin-' + 'a' * 40, allowed_hosts=('testserver',),
            allowed_origins=('https://example.github.io',))

    def tearDown(self):
        self.temp.cleanup()

    def app(self, **changes):
        return create_app(dataclasses.replace(self.settings, **changes))

    def login(self, client):
        response = client.post('/api/access/session', json={'code': self.settings.access_code})
        self.assertEqual(response.status_code, 200, response.text)
        return {'Authorization': 'Bearer ' + response.json()['accessToken']}

    def test_production_fails_closed_and_hides_settings(self):
        for changes in ({'access_code': ''}, {'admin_token': 'short'}, {'allowed_origins': ('*',)},
                        {'allowed_origins': ('https://example.com/path',)}, {'allowed_hosts': ('*',)}):
            with self.assertRaises(ValueError):
                dataclasses.replace(self.settings, **changes)
        self.assertNotIn(self.settings.access_code, repr(self.settings))
        self.assertNotIn(self.settings.admin_token, repr(self.settings))

    def test_public_queries_work_but_writes_require_admin(self):
        with TestClient(self.app(), base_url='https://testserver') as client:
            self.assertEqual(client.get('/api/hardware').status_code, 200)
            for method, path in [('POST', '/api/quotes/import'), ('POST', '/api/quotes/import-csv'),
                                 ('DELETE', '/api/quotes/test'), ('POST', '/api/jd/search'),
                                 ('POST', '/api/jd/details'), ('POST', '/api/jd/pool/collect'),
                                 ('POST', '/api/taobao/search'), ('POST', '/api/future-write')]:
                self.assertEqual(client.request(method, path, json={}).status_code, 403, path)
            visitor = self.login(client)
            self.assertEqual(client.post('/api/quotes/import', json={}, headers=visitor).status_code, 403)
            admin = {'Authorization': 'Bearer ' + self.settings.admin_token}
            self.assertEqual(client.post('/api/quotes/import', json={}, headers=admin).status_code, 422)

    def test_online_features_require_real_session(self):
        with TestClient(self.app(), base_url='https://testserver') as client:
            for path in ('/api/ai/chat', '/api/ai/recommendations', '/api/market/alternatives/discover'):
                body = {'collect': True} if 'market' in path else {}
                response = client.post(path, json=body)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()['detail']['code'], 'access_required')
            headers = self.login(client)
            self.assertEqual(client.post('/api/ai/chat', json={}, headers=headers).status_code, 422)
            self.assertEqual(client.post('/api/ai/chat', json={}, headers={'Authorization': 'Bearer invented'}).status_code, 401)
            self.assertEqual(client.post('/api/market/alternatives/discover', json={'collect': False}).status_code, 422)

    def test_tokens_hashed_expire_and_are_not_admin_tokens(self):
        with TestClient(self.app(), base_url='https://testserver') as client:
            headers = self.login(client)
            token = headers['Authorization'][7:]
            db = Database(self.settings.database_path)
            with db.connect() as connection:
                rows = connection.execute('SELECT * FROM security_sessions').fetchall()
                self.assertNotIn(token, str([dict(row) for row in rows]))
                connection.execute('UPDATE security_sessions SET expires_at=0')
            self.assertEqual(client.post('/api/ai/chat', json={}, headers=headers).status_code, 401)

    def test_real_ai_calls_are_metered_before_network_and_not_exposed(self):
        calls = []
        def provider(request):
            calls.append(request)
            return httpx.Response(200, json={'choices': [{'message': {'content': '{"findings":[]}'}}]})
        app = self.app(ai_api_key='private-vendor-test-key', ai_model='test-model', ai_daily_limit=1)
        body = dict(facts={f'{part}.name': part for part in ('cpu', 'gpu', 'board', 'ram', 'ssd', 'case', 'power', 'cooler')},
                    rules=dict(errors=[], warnings=[], pending=[]))
        with TestClient(app, base_url='https://testserver') as client:
            app.state.ai_service.transport = httpx.MockTransport(provider)
            headers = self.login(client)
            response = client.post('/api/ai/compatibility', json=body, headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertNotIn('private-vendor-test-key', response.text)
            self.assertEqual(client.post('/api/ai/compatibility', json=body, headers=headers).status_code, 429)
            self.assertEqual(len(calls), 1)

    def test_vendor_global_budget_also_covers_ai_initiated_collection(self):
        app = self.app(collection_daily_limit=1)
        with TestClient(app, base_url='https://testserver'):
            app.state.jd_client.before_request()
            with self.assertRaises(HTTPException):
                app.state.taobao_client.before_request()

    def test_persistent_quota_is_atomic_for_concurrent_callers(self):
        database = Database(self.settings.database_path)
        database.initialize()
        def reserve(_):
            store = SecurityStore(database, self.settings)
            try:
                store.consume([('concurrent-test', 86400, 2)])
                return True
            except HTTPException:
                return False
        with ThreadPoolExecutor(max_workers=8) as workers:
            results = list(workers.map(reserve, range(12)))
        self.assertEqual(sum(results), 2)

    def test_generic_api_rate_limit_and_forwarding_cannot_change_bucket(self):
        with TestClient(self.app(api_requests_per_minute=1), base_url='https://testserver') as client:
            self.assertEqual(client.get('/api/health').status_code, 200)
            self.assertEqual(client.get('/api/health', headers={'X-Forwarded-For': '198.51.100.1'}).status_code, 429)

    def test_login_throttles_and_does_not_echo_code(self):
        with TestClient(self.app(), base_url='https://testserver') as client:
            for _ in range(5):
                response = client.post('/api/access/session', json={'code': 'incorrect-private-input'})
                self.assertEqual(response.status_code, 401)
                self.assertNotIn('incorrect-private-input', response.text)
            response = client.post('/api/access/session', json={'code': self.settings.access_code})
            self.assertEqual(response.status_code, 429)
            self.assertIn('Retry-After', response.headers)

    def test_host_origin_https_headers_and_no_public_docs(self):
        with TestClient(self.app(), base_url='https://testserver') as client:
            self.assertEqual(client.get('/api/health', headers={'Host': 'evil.example'}).status_code, 400)
            self.assertEqual(client.get('/api/hardware', headers={'Origin': 'https://evil.example'}).status_code, 403)
            self.assertEqual(client.get('http://testserver/api/hardware').status_code, 400)
            response = client.get('/api/health', headers={'Origin': 'https://example.github.io'})
            self.assertEqual(response.headers['access-control-allow-origin'], 'https://example.github.io')
            self.assertEqual(response.headers['x-content-type-options'], 'nosniff')
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertIn('strict-transport-security', response.headers)
            for path in ('/docs', '/openapi.json', '/.env', '/server/storage/nexbuild.sqlite3'):
                self.assertEqual(client.get(path).status_code, 404)
            response = client.options('/api/ai/chat', headers={'Origin': 'https://example.github.io',
                'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'})
            self.assertEqual(response.status_code, 200)

    def test_body_limit_content_type_and_validation_redaction(self):
        with TestClient(self.app(max_request_bytes=256), base_url='https://testserver') as client:
            self.assertEqual(client.post('/api/market/compare', content='x' * 257, headers={'Content-Type': 'application/json'}).status_code, 413)
            self.assertEqual(client.post('/api/market/compare', content='{}', headers={'Content-Type': 'text/plain'}).status_code, 415)
            response = client.post('/api/market/compare', json={'secret-input': 'do-not-echo'})
            self.assertEqual(response.status_code, 422)
            self.assertNotIn('do-not-echo', response.text)

    def test_rate_and_global_ai_budget_survive_app_recreation(self):
        app = self.app(ai_requests_per_minute=1)
        with TestClient(app, base_url='https://testserver') as client:
            headers = self.login(client)
            self.assertEqual(client.post('/api/ai/chat', json={}, headers=headers).status_code, 422)
            self.assertEqual(client.post('/api/ai/chat', json={}, headers=headers).status_code, 429)
        app = self.app(ai_daily_limit=1)
        with TestClient(app, base_url='https://testserver'):
            app.state.security.consume_ai_call()
            with self.assertRaises(HTTPException):
                app.state.security.consume_ai_call()
        with TestClient(self.app(ai_daily_limit=1), base_url='https://testserver') as client:
            with self.assertRaises(HTTPException):
                client.app.state.security.consume_ai_call()

    def test_collection_budget_not_consumed_by_database_lookup(self):
        with TestClient(self.app(collection_daily_limit=1), base_url='https://testserver') as client:
            headers = self.login(client)
            path = '/api/market/alternatives/discover'
            self.assertEqual(client.post(path, json={'collect': False}).status_code, 422)
            self.assertEqual(client.post(path, json={'collect': True}, headers=headers).status_code, 422)
            self.assertEqual(client.post(path, json={'collect': True}, headers=headers).status_code, 429)

    def test_development_refuses_remote_even_with_forwarding_header(self):
        settings = dataclasses.replace(self.settings, security_mode='development')
        with TestClient(create_app(settings), client=('203.0.113.10', 1234)) as client:
            self.assertEqual(client.get('/api/health', headers={'X-Forwarded-For': '127.0.0.1'}).status_code, 403)

    def test_unhandled_errors_are_generic(self):
        app = self.app()
        @app.get('/api/hardware/test/nested/offers')
        def broken():
            raise RuntimeError('sensitive-provider-secret')
        with TestClient(app, base_url='https://testserver') as client:
            response = client.get('/api/hardware/test/nested/offers')
            self.assertEqual(response.status_code, 500)
            self.assertNotIn('sensitive-provider-secret', response.text)

    def test_chunked_body_without_content_length_is_bounded(self):
        db = Database(self.settings.database_path)
        db.initialize()
        settings = dataclasses.replace(self.settings, max_request_bytes=10)
        app = AsyncMock()
        middleware = SecurityMiddleware(app, settings, SecurityStore(db, settings))
        scope = {'type': 'http', 'method': 'POST', 'scheme': 'https', 'path': '/api/market/compare',
                 'client': ('127.0.0.1', 1), 'headers': [(b'host', b'testserver'), (b'content-type', b'application/json')]}
        messages = iter([{'type': 'http.request', 'body': b'123456', 'more_body': True},
                         {'type': 'http.request', 'body': b'789012', 'more_body': False}])
        async def receive(): return next(messages)
        sent = []
        async def send(message): sent.append(message)
        asyncio.run(middleware(scope, receive, send))
        self.assertEqual(sent[0]['status'], 413)
        app.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
