import json
import unittest
from pathlib import Path
import httpx
from fastapi import HTTPException
from pydantic import ValidationError
from app.api.ai import AIService, WorkloadRequest
from app.config import Settings

CATEGORIES = ('cpu', 'gpu', 'board', 'ram', 'ssd', 'power', 'case', 'cooler')
WEIGHTS = dict(gaming=56, creation=24, office=10, ai=10)


def request_body(**changes):
    return WorkloadRequest(**{**dict(facts={f'build.{key}.name': key for key in CATEGORIES},
        rules=dict(errors=[], warnings=[], pending=[]), budget=9000, demandWeights=WEIGHTS,
        choices=[dict(id=key, category=key, name='Hardware ' + key, price=100, specs='Known specifications') for key in CATEGORIES]), **changes})


def advice(**changes):
    return {**dict(summary='结合四项需求保留合适配件，说明整体取舍。', demandWeights=WEIGHTS,
        questions=[], plans=[dict(title='整机方案', parts={key: key for key in CATEGORIES},
            reasons={key: '依据给定规格匹配需求' for key in CATEGORIES}, tradeoffs=['价格为项目参考价，BIOS仍需核验'])]), **changes}


class WorkloadAITests(unittest.IsolatedAsyncioTestCase):
    async def run_advice(self, output, body=None, capture=None):
        async def handler(request):
            if capture is not None:
                capture.append(json.loads(request.content))
            return httpx.Response(200, json={'choices': [{'message': {'content': json.dumps(output)}}]})
        service = AIService(Settings(Path('unused.sqlite3'), ai_api_key='test', ai_model='test'), httpx.MockTransport(handler))
        return await service.review(body or request_body())

    async def test_whole_build_provenance_and_feedback(self):
        calls = []
        response = await self.run_advice(advice(), request_body(feedback=['处理器接口与主板不匹配']), calls)
        self.assertEqual(response['provider'], 'doubao')
        self.assertEqual(set(response['plans'][0]['parts']), set(CATEGORIES))
        prompt = calls[0]['messages'][0]['content']
        self.assertIn('完整8类配件', prompt)
        data = json.loads(calls[0]['messages'][1]['content'])
        self.assertEqual(data['feedback'], ['处理器接口与主板不匹配'])
        self.assertEqual(data['demandWeights'], WEIGHTS)
        self.assertNotIn('tools', calls[0], 'Workload planning must not invoke paid search/collection tools')

    async def test_unknown_ids_and_missing_category_rejected(self):
        for unknown in (True, False):
            output = advice()
            if unknown:
                output['plans'][0]['parts']['cpu'] = 'invented-cpu'
            else:
                del output['plans'][0]['parts']['power']
            with self.assertRaises(HTTPException) as error:
                await self.run_advice(output)
            self.assertEqual(error.exception.status_code, 502)

    async def test_over_budget_allowed(self):
        body = request_body(choices=[dict(id=key, category=key, name='Hardware ' + key, price=2000, specs='Known') for key in CATEGORIES])
        response = await self.run_advice(advice(), body)
        self.assertEqual(len(response['plans']), 1)

    async def test_truncated_output_has_specific_error(self):
        async def handler(request):
            return httpx.Response(200, json={'choices': [{'finish_reason': 'length', 'message': {'content': '{'}}]})
        service = AIService(Settings(Path('unused.sqlite3'), ai_api_key='test', ai_model='test'), httpx.MockTransport(handler))
        with self.assertRaises(HTTPException) as error:
            await service.review(request_body())
        self.assertIn('截断', error.exception.detail)

    async def test_natural_language_can_interpret_weights(self):
        weights = dict(gaming=10, creation=10, office=10, ai=70)
        output = advice(demandWeights=weights)
        question = '主要用来运行本地AI，偶尔玩游戏，希望安静一些'
        calls = []
        response = await self.run_advice(output, request_body(question=question), calls)
        self.assertEqual(json.loads(calls[0]['messages'][1]['content'])['question'], question)
        self.assertIn('无法保证静音', calls[0]['messages'][0]['content'])
        self.assertEqual(response['demandWeights'], weights)
        with self.assertRaises(HTTPException):
            await self.run_advice(output)

    async def test_clarification_has_no_applicable_plan(self):
        output = advice(questions=['文字预算与左侧预算不同，请确认。'], plans=[])
        response = await self.run_advice(output, request_body(question='预算两万'))
        self.assertEqual(response['plans'], [])
        output['plans'] = advice()['plans']
        with self.assertRaises(HTTPException):
            await self.run_advice(output)

    async def test_unconfigured_ai_does_not_fake_results(self):
        service = AIService(Settings(Path('unused.sqlite3')))
        with self.assertRaises(HTTPException) as error:
            await service.review(request_body())
        self.assertEqual(error.exception.status_code, 503)

    async def test_weight_sum_and_duplicate_ids_validation(self):
        with self.assertRaises(ValidationError):
            request_body(demandWeights=dict(gaming=100, creation=100, office=0, ai=0))
        choices = request_body().choices
        with self.assertRaises(ValidationError):
            request_body(choices=[*choices, choices[0]])
