"""AI proposes models first; local evidence, then bounded collection, resolves them."""
import asyncio
import re
import time
from fastapi import APIRouter, Request
from pydantic import Field
from .ai import DiscoveryRequest, until_disconnected
from .routes import CatalogModel
from ..cleaning.model_match import matches
from ..ingestion.market_comparison import MarketComparisonService, market_keyword
from ..ingestion.jd_search import JDSearchService
from ..integrations.jd.client import JDError
from ..integrations.taobao import TaobaoError

router = APIRouter(prefix='/api/ai')


def catalog_matches(model, catalog):
    return [item for item in catalog if item.category == model['category'] and matches(
        model['category'], model['brand'], model['modelName'], model['specs'], dict(name=item.modelName, brand=item.brand))]


def refinement_choices(body):
    """Offer known versions for AI to choose after its initial recommendation."""
    current = body.facts.get(f'build.{body.category}.name', '')
    if body.purpose == 'workload':
        buckets = {}
        for item in body.catalog:
            if item.modelName != body.facts.get(f'build.{item.category}.name'):
                buckets.setdefault(item.category, []).append(item)
        return [items[index] for index in range(3) for items in buckets.values() if index < len(items)][:20]
    choices = [item for item in body.catalog if item.category == body.category and item.modelName != current]
    if body.category == 'gpu':
        def chip(name):
            found = re.search(r'RTX\s*(\d)(\d{2})\d\s*(Ti)?\s*(SUPER)?', name, re.I)
            return (int(found[1]), int(found[2]) + (0.5 if found[3] else 0.25 if found[4] else 0)) if found else None
        source = chip(current)
        if not source:
            return []
        choices = [item for item in choices if chip(item.modelName) and (
            (chip(item.modelName) == source) if body.purpose == 'similar' else
            (chip(item.modelName)[0] >= source[0] and source[1] < chip(item.modelName)[1] <= source[1] + 1))]
    return choices[:16]


class ResolveRequest(DiscoveryRequest):
    catalog: list[CatalogModel] = Field(max_length=400)


def resolve_models(state, recommendations, catalog, max_collect=2):
    results = []
    attempts = 0
    unavailable = set()
    last_taobao = 0.0
    for recommendation in recommendations:
        category, brand, name, specs = (recommendation[key] for key in ('category', 'brand', 'modelName', 'specs'))
        known = catalog_matches(recommendation, catalog)
        def lookup():
            products = MarketComparisonService(state.database).compare(category, brand, name, specs)['products']
            return next((item for item in products if not item['stale'] and item['price'] and item['productUrl']), None)
        offer = lookup()
        collection = 'database' if offer else 'not_found'
        errors = []
        # Bound external requests; retries for the same exact model have a cooldown.
        key = (category, brand, name, specs)
        last = state.recommendation_attempts.get(key, 0)
        if not offer and attempts < max_collect and time.monotonic() - last >= 600:
            state.recommendation_attempts[key] = time.monotonic()
            attempts += 1
            attempted = False
            keyword = market_keyword(category, brand, name, specs)
            for platform in ('jd', 'taobao'):
                if platform in unavailable:
                    errors.append(platform + '本轮采集接口不可用')
                    continue
                client = state.jd_client if platform == 'jd' else state.taobao_client
                if not (client.configured if platform == 'jd' else client.search_configured):
                    continue
                attempted = True
                try:
                    if platform == 'jd':
                        JDSearchService(state.database, client).search(keyword, 1, 20)
                    else:
                        # Respect the integration's existing minimum request interval.
                        # Repeat queries are cached by the ingestion service.
                        if last_taobao:
                            time.sleep(max(0, state.taobao_search.MIN_INTERVAL_SECONDS + 0.1 - (time.monotonic() - last_taobao)))
                        state.taobao_search.search(keyword, 1, 20)
                        last_taobao = time.monotonic()
                    offer = lookup()
                    if offer:
                        break
                except (JDError, TaobaoError) as error:
                    code = re.sub(r'[^a-zA-Z0-9_.-]', '', str(error.code))[:80]
                    errors.append(platform + '采集暂不可用' + (f' [{code}]' if code else ''))
                    if str(error.code) in ('403', '401'):
                        unavailable.add(platform)
            collection = 'collected' if offer else 'no_exact_offer' if attempted else 'not_configured'
        elif not offer and time.monotonic() - last < 600:
            collection = 'cooldown'
        results.append(dict(**recommendation, optionIds=[item.id for item in known], offer=offer,
                            collection=collection, collectionErrors=errors,
                            selectable=bool(known)))
    return results


@router.post('/recommendations')
async def recommendations(body: ResolveRequest, request: Request):
    return await until_disconnected(request, resolve_recommendations(body, request))


async def resolve_recommendations(body, request):
    state = request.app.state
    if not hasattr(state, 'recommendation_attempts'):
        state.recommendation_attempts = {}
    # No catalog data in the AI request: model recommendations precede database lookup.
    proposal = await state.ai_service.review(DiscoveryRequest(**body.model_dump(exclude={'catalog'})))
    # If free-form names miss our registered versions, ask Doubao to select actual
    # registered models. Never silently relabel an unrelated model as its recommendation.
    choices = refinement_choices(body)
    unmatched = [model for model in proposal['recommendations'] if not catalog_matches(model, body.catalog)]
    if choices and unmatched and (body.purpose == 'workload' or len(unmatched) == len(proposal['recommendations'])):
        facts = dict(body.facts)
        facts['context.refine'] = '第一轮建议没有对应的标准型号。请从available字段中的真实入库型号选择，完整照抄品牌和型号；不可用就返回空数组。预算重分配须说明降低哪些配件预算，游戏升级显卡优先提升芯片档位，可考虑CPU、SSD、散热器，不要仅更换同芯片大显存版本。'
        facts['context.initialAdvice'] = proposal['summary']
        if body.purpose == 'workload':
            facts['context.refine'] = '部分初步建议未对应入库型号，可能存在容量/版本错误。仅校准context.unmatched中的建议，综合demandWeights四项用途占比，从available里选择真实完整型号，各项可以属于不同category，说明取舍和可让出预算的类别；不是只升级显卡，不可用就返回空数组。已匹配项会由程序保留，不重复输出。'
            facts['context.unmatched'] = '；'.join(model['category'] + ':' + model['brand'] + ' ' + model['modelName'] for model in unmatched)[:600]
        for index, item in enumerate(choices):
            facts[f'available.{index}.name'] = item.modelName
            facts[f'available.{index}.brand'] = item.brand
            facts[f'available.{index}.specs'] = item.specs
            if body.purpose == 'workload': facts[f'available.{index}.category'] = item.category
        refined = await state.ai_service.review(DiscoveryRequest(facts=facts, rules=body.rules, category=body.category, purpose=body.purpose, demandWeights=body.demandWeights))
        allowed = [model for model in refined['recommendations'] if catalog_matches(model, choices)]
        if allowed:
            kept = [model for model in proposal['recommendations'] if catalog_matches(model, body.catalog)] if body.purpose == 'workload' else []
            merged = {(model['category'], model['brand'], model['modelName']): model for model in [*kept, *allowed]}
            proposal = dict(provider=refined['provider'], summary=proposal['summary'] if kept else refined['summary'], recommendations=list(merged.values())[:4])
    results = await asyncio.to_thread(resolve_models, state, proposal['recommendations'], body.catalog)
    return dict(provider=proposal['provider'], summary=proposal['summary'], recommendations=results)
