import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.api.ai import AIService


class RecommendationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings = Settings(Path(self.temp.name) / 'test.db', ai_api_key='test', ai_model='test')
        self.context = TestClient(create_app(self.settings))
        self.api = self.context.__enter__()
        self.model = dict(category='gpu', brand='影驰', modelName='影驰 GeForce RTX 5060 Ti 圣刃 OC 8GB', specs='8GB')
        self.body = dict(facts={f'build.{part}.name': part for part in ['cpu','gpu','board','ram','ssd','power','case','cooler']},
                         rules=dict(errors=[], warnings=[], pending=[]), category='gpu', purpose='similar',
                         catalog=[dict(id='gpu-model', **self.model)])

    def tearDown(self):
        self.context.__exit__(None, None, None)
        self.temp.cleanup()

    def install_ai(self, model=None):
        def handler(request):
            payload = json.loads(request.content)
            self.assertNotIn('catalog', json.loads(payload['messages'][1]['content']))
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(dict(
                summary='Test recommendation', recommendations=[dict(**(model or self.model), reason='Same class', reduceCategories=[])]))}}]})
        self.api.app.state.ai_service = AIService(self.settings, httpx.MockTransport(handler))

    def test_ai_first_exact_database_match_and_no_collection(self):
        self.install_ai()
        with self.api.app.state.database.connect() as db:
            db.execute("INSERT INTO ingestion_tasks VALUES('t','jd','completed',datetime('now'),NULL)")
            raw = db.execute("INSERT INTO raw_records(task_id,captured_at,payload_json) VALUES('t',datetime('now'),?)", ('{"owner":"g"}',)).lastrowid
            db.execute("INSERT INTO products(id,platform,platform_product_id,shop,product_url) VALUES('p','jd','123','自营','https://item.jd.com/123.html')")
            db.execute("INSERT INTO product_details VALUES('p',?,'影驰',?)", (self.model['modelName'], raw))
            db.execute("INSERT INTO price_snapshots(product_id,task_id,raw_record_id,price_cents,price_type,collected_at) VALUES('p','t',?,399900,'listed',datetime('now'))", (raw,))
        with patch('app.api.recommendations.JDSearchService.search') as search:
            response = self.api.post('/api/ai/recommendations', json=self.body)
            self.assertEqual(response.status_code, 200, response.text)
            item = response.json()['recommendations'][0]
            self.assertEqual(item['optionIds'], ['gpu-model'])
            self.assertEqual(item['offer']['price'], 3999)
            self.assertEqual(item['collection'], 'database')
            search.assert_not_called()

    def test_missing_model_collects_once_and_never_becomes_verified_hardware(self):
        self.install_ai({**self.model, 'modelName': '影驰 GeForce RTX 5070 星曜 OC 12GB', 'specs': '12GB'})
        self.api.app.state.jd_client = SimpleNamespace(configured=True)
        with patch('app.api.recommendations.JDSearchService.search', return_value={'items': []}) as search:
            first = self.api.post('/api/ai/recommendations', json=self.body).json()['recommendations'][0]
            second = self.api.post('/api/ai/recommendations', json=self.body).json()['recommendations'][0]
            self.assertFalse(first['selectable'])
            self.assertEqual(first['optionIds'], [])
            self.assertEqual(first['collection'], 'no_exact_offer')
            self.assertEqual(second['collection'], 'cooldown')
            self.assertEqual(search.call_count, 1)

    def test_wrong_category_from_ai_rejected(self):
        self.install_ai({**self.model, 'category': 'cpu'})
        self.assertEqual(self.api.post('/api/ai/recommendations', json=self.body).status_code, 502)

    def test_workload_weights_reach_doubao_and_allow_whole_build_categories(self):
        self.body.update(purpose='workload', demandWeights=dict(gaming=40, creation=30, office=10, ai=20))
        cpu = dict(category='cpu', brand='AMD', modelName='AMD Ryzen 7 9700X', specs='AM5')
        self.body['catalog'].append(dict(id='cpu-9700x', **cpu))
        calls = []
        def handler(request):
            data = json.loads(json.loads(request.content)['messages'][1]['content'])
            calls.append(data)
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(dict(
                summary='Balance gaming and creation', recommendations=[dict(**cpu, reason='CPU for creation 30%', reduceCategories=['cooler'])]))}}]})
        self.api.app.state.ai_service = AIService(self.settings, httpx.MockTransport(handler))
        response = self.api.post('/api/ai/recommendations', json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(calls[0]['demandWeights'], self.body['demandWeights'])
        self.assertEqual(response.json()['recommendations'][0]['category'], 'cpu')
        self.assertEqual(response.json()['recommendations'][0]['optionIds'], ['cpu-9700x'])

    def test_workload_weights_validate_total_range_and_presence(self):
        self.body.update(purpose='workload')
        for weights in [None, dict(gaming=100, creation=10, office=0, ai=0), dict(gaming=-1, creation=1, office=100, ai=0)]:
            if weights is None: self.body.pop('demandWeights', None)
            else: self.body['demandWeights'] = weights
            self.assertEqual(self.api.post('/api/ai/recommendations', json=self.body).status_code, 422)

    def test_workload_refines_unmatched_model_even_with_an_existing_valid_suggestion(self):
        weights = dict(gaming=40, creation=30, office=20, ai=10)
        self.body.update(purpose='workload', demandWeights=weights)
        known = dict(category='cpu', brand='AMD', modelName='AMD Ryzen 7 9700X', specs='AM5')
        self.body['catalog'].append(dict(id='known-cpu', **known))
        calls = []
        def handler(request):
            data = json.loads(json.loads(request.content)['messages'][1]['content'])
            calls.append(data)
            models = [known] if 'context.unmatched' in data['facts'] else [self.model, {**known, 'modelName': 'Unknown CPU version'}]
            records = [dict(**model, reason='Demand weighted choice', reduceCategories=['cooler']) for model in models]
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(dict(summary='Mixed demand', recommendations=records))}}]})
        self.api.app.state.ai_service = AIService(self.settings, httpx.MockTransport(handler))
        response = self.api.post('/api/ai/recommendations', json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1]['demandWeights'], weights)
        self.assertEqual({item['category'] for item in response.json()['recommendations']}, {'cpu', 'gpu'})
        self.assertTrue(all(item['optionIds'] for item in response.json()['recommendations']))

    def test_standard_alternatives_never_call_ai_and_collection_is_optional(self):
        self.api.app.state.jd_client = SimpleNamespace(configured=True)
        with patch.object(self.api.app.state.ai_service, 'review', side_effect=AssertionError('AI must not be called')):
            with patch('app.api.recommendations.JDSearchService.search', return_value={'items': []}) as search:
                body = dict(models=self.body['catalog'], collect=False)
                result = self.api.post('/api/market/alternatives', json=body)
                self.assertEqual(result.status_code, 200, result.text)
                self.assertEqual(result.json()['recommendations'][0]['optionIds'], ['gpu-model'])
                search.assert_not_called()
                body['collect'] = True
                self.assertEqual(self.api.post('/api/market/alternatives', json=body).status_code, 200)
                self.assertEqual(search.call_count, 1)
                self.assertEqual(self.api.post('/api/market/alternatives', json=body).status_code, 200)
                self.assertEqual(search.call_count, 1, 'Collection must respect cooldown')

    def test_second_ai_pass_chooses_registered_upgrade_version(self):
        known = {**self.model, 'modelName': '影驰 GeForce RTX 5070 圣刃 OC 12GB', 'specs': '12GB'}
        self.body['purpose'] = 'rebalance'
        self.body['facts']['build.gpu.name'] = self.model['modelName']
        self.body['catalog'].append(dict(id='registered-5070', **known))
        calls = []
        def handler(request):
            facts = json.loads(json.loads(request.content)['messages'][1]['content'])['facts']
            calls.append(facts)
            model = known if 'available.0.name' in facts else {**known, 'modelName': '影驰 GeForce RTX 5070 星曜 OC 12GB'}
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(dict(summary='Upgrade GPU', recommendations=[dict(**model, reason='Lower CPU and cooler spending', reduceCategories=['cpu','cooler'])]))}}]})
        self.api.app.state.ai_service = AIService(self.settings, httpx.MockTransport(handler))
        response = self.api.post('/api/ai/recommendations', json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(calls), 2)
        self.assertNotIn('available.0.name', calls[0])
        self.assertEqual(response.json()['recommendations'][0]['optionIds'], ['registered-5070'])
