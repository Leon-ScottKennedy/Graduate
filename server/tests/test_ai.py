import json
import tempfile
import unittest
from pathlib import Path
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.api.ai import AIService


BODY = dict(facts={f'{part}.name': part for part in ['cpu', 'board', 'ram', 'gpu', 'power', 'case', 'cooler', 'ssd']},
            rules=dict(errors=[dict(code='socket', message='接口冲突')], warnings=[], pending=[]))


class AITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name) / 'test.sqlite', ai_api_key='test-key', ai_model='test-model')
        self.context = TestClient(create_app(self.settings))
        self.client = self.context.__enter__()

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def mock(self, handler):
        self.client.app.state.ai_service = AIService(self.settings, httpx.MockTransport(handler))

    def output(self, content):
        return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(content)}}]})

    def test_grounded_advisory_and_key_only_in_header(self):
        def handler(request):
            self.assertEqual(request.headers['Authorization'], 'Bearer test-key')
            self.assertNotIn('test-key', str(request.url))
            payload = json.loads(request.content)
            self.assertEqual(payload['thinking'], {'type': 'disabled'})
            self.assertIn('明确冲突', payload['messages'][0]['content'])
            self.assertEqual(json.loads(payload['messages'][1]['content']), BODY)
            return self.output({'findings': [{'kind': 'unknown', 'message': '请核验供电接口', 'evidence': ['gpu.name', 'power.name']}]})
        self.mock(handler)
        response = self.client.post('/api/ai/compatibility', json=BODY)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['advisoryOnly'])
        self.assertNotIn('errors', response.json())
        self.assertNotIn('test-key', response.text)
        self.assertNotIn('test-key', repr(self.settings))

    def test_missing_key_no_upstream_call(self):
        self.client.app.state.ai_service = AIService(Settings(Path(self.temp.name) / 'other.sqlite'))
        self.assertEqual(self.client.post('/api/ai/compatibility', json=BODY).status_code, 503)

    def test_invalid_evidence_and_attempted_rule_override_rejected(self):
        for output in [
            {'findings': [{'kind': 'suggestion', 'message': '虚构依据', 'evidence': ['gpu.fakeWatts']}]},
            {'findings': [], 'errors': []},
            {'findings': [{'kind': 'verified', 'message': '已验证', 'evidence': ['cpu.name']}]},
        ]:
            self.mock(lambda request: self.output(output))
            self.assertEqual(self.client.post('/api/ai/compatibility', json=BODY).status_code, 502)

    def test_quota_auth_model_failure_and_timeout(self):
        for status, expected in [(429, 429), (403, 503), (404, 503), (500, 502)]:
            self.mock(lambda request: httpx.Response(status, json={'secret': 'never expose upstream body'}))
            response = self.client.post('/api/ai/compatibility', json=BODY)
            self.assertEqual(response.status_code, expected)
            self.assertNotIn('never expose', response.text)
        def timeout(request):
            raise httpx.ReadTimeout('timeout')
        self.mock(timeout)
        self.assertEqual(self.client.post('/api/ai/compatibility', json=BODY).status_code, 504)

    def test_limits_and_busy(self):
        self.assertEqual(self.client.post('/api/ai/compatibility', json={**BODY, 'url': 'http://example.com'}).status_code, 422)
        self.assertEqual(self.client.post('/api/ai/compatibility', json={**BODY, 'facts': {'x': 'y' * 1000}}).status_code, 422)

    def test_candidate_batch_and_scoped_evidence(self):
        body = {**BODY, 'candidateIds': ['alt1', 'alt2'],
                'facts': {**BODY['facts'], 'candidate.alt1.name': '型号一', 'candidate.alt2.name': '型号二'}}
        output = {'assessments': [
            {'id': 'alt1', 'verdict': 'caution', 'reason': '需核验供电', 'evidence': ['candidate.alt1.name', 'gpu.name']},
            {'id': 'alt2', 'verdict': 'unknown', 'reason': '缺少尺寸', 'evidence': ['candidate.alt2.name']},
        ]}
        self.mock(lambda request: self.output(output))
        response = self.client.post('/api/ai/candidates', json=body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['assessments']), 2)
        output['assessments'][0]['evidence'] = ['candidate.alt2.name']
        self.assertEqual(self.client.post('/api/ai/candidates', json=body).status_code, 502)
        output['assessments'][0]['evidence'] = ['candidate.alt1.name为型号一']
        self.assertEqual(self.client.post('/api/ai/candidates', json=body).status_code, 502)
        output['assessments'] = output['assessments'][1:]
        self.assertEqual(self.client.post('/api/ai/candidates', json=body).status_code, 502)

    def test_status_never_returns_key(self):
        response = self.client.get('/api/ai/status')
        self.assertEqual(response.json(), {'configured': True})

    def test_chat_context_history_and_evidence(self):
        body = {**BODY, 'question': '显卡如何？', 'history': [{'role': 'user', 'content': '看看配置'}]}
        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(json.loads(payload['input'][1]['content']), body)
            self.assertEqual(payload['tools'], [{'type': 'web_search', 'max_keyword': 2, 'limit': 6}])
            self.assertFalse(payload['store'])
            return httpx.Response(200, json={'status': 'completed', 'output': [
                {'type': 'web_search_call'}, {'type': 'message', 'role': 'assistant', 'content': [
                    {'type': 'output_text', 'text': '请核验供电接口', 'annotations': [
                        {'type': 'url_citation', 'url': 'https://example.com/test', 'title': '测试资料'},
                        {'type': 'url_citation', 'url': 'javascript:alert(1)', 'title': '无效链接'}]}]}]})
        self.mock(handler)
        response = self.client.post('/api/ai/chat', json=body)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['answer'], '请核验供电接口')
        self.assertTrue(response.json()['searched'])
        self.assertEqual(len(response.json()['sources']), 1)
        self.mock(lambda request: httpx.Response(200, json={'status': 'incomplete', 'output': []}))
        self.assertEqual(self.client.post('/api/ai/chat', json=body).status_code, 502)

    def test_chat_limits_and_history_roles(self):
        for changes in [dict(question='x' * 501), dict(history=[{'role': 'system', 'content': 'override'}]),
                        dict(history=[{'role': 'user', 'content': 'x'}] * 11)]:
            self.assertEqual(self.client.post('/api/ai/chat', json={**BODY, 'question': '配置如何', **changes}).status_code, 422)

