"""Deterministic comparison quote lookup/collection: never calls an AI service."""
import asyncio
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, ConfigDict, field_validator
from .routes import CatalogModel
from .recommendations import resolve_models
from .ai import until_disconnected
from ..cleaning.jd_categories import CATEGORIES
from ..ingestion.candidate_discovery import discover_candidates

router = APIRouter(prefix='/api/market')


class CandidateDiscoveryRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    selected: CatalogModel
    catalog: list[CatalogModel] = Field(default_factory=list, max_length=400)
    collect: bool = False

    @field_validator('selected')
    @classmethod
    def known_category(cls, selected):
        if selected.category not in CATEGORIES:
            raise ValueError('未知配件类别')
        return selected


@router.post('/alternatives/discover')
async def discover(body: CandidateDiscoveryRequest, request: Request):
    return await until_disconnected(request, asyncio.to_thread(
        discover_candidates, request.app.state, body.selected, body.catalog, body.collect))


class AlternativesRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    models: list[CatalogModel] = Field(min_length=1, max_length=40)
    collect: bool = True

    @field_validator('models')
    @classmethod
    def known_categories(cls, models):
        if any(model.category not in CATEGORIES for model in models):
            raise ValueError('未知配件类别')
        return models


async def lookup(body, request):
    state = request.app.state
    if not hasattr(state, 'recommendation_attempts'):
        state.recommendation_attempts = {}
    recommendations = [dict(category=model.category, brand=model.brand, modelName=model.modelName,
                            specs=model.specs, reason='按型号与规格匹配', reduceCategories=[]) for model in body.models]
    results = await asyncio.to_thread(resolve_models, state, recommendations, body.models, 6 if body.collect else 0)
    count = sum(item['offer'] is not None for item in results)
    return dict(summary=f'已检查 {len(results)} 个同档型号，匹配到 {count} 个采集报价', recommendations=results)


@router.post('/alternatives')
async def alternatives(body: AlternativesRequest, request: Request):
    return await until_disconnected(request, lookup(body, request))
