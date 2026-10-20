from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field, ConfigDict, field_validator
from ..models.responses import HardwareResponse, OfferResponse
from ..integrations.jd.client import JDError, METHOD, DETAIL_METHOD
from ..cleaning.jd_input import parse_sku_inputs
from ..ingestion.jd_search import JDSearchService
from ..ingestion.jd_pool import JDPoolService
from ..ingestion.jd_comparison import JDComparisonService
from ..ingestion.market_comparison import MarketComparisonService
from ..cleaning.jd_categories import CATEGORIES

router = APIRouter(prefix="/api")


class JDSearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra='forbid')
    keyword: str = Field(min_length=2, max_length=120)
    page: int = Field(default=1, ge=1, le=100)
    page_size: int = Field(default=20, ge=1, le=50, alias='pageSize')

    @field_validator('keyword')
    @classmethod
    def normalize_keyword(cls, value):
        value = ' '.join(value.split())
        if len(value) < 2:
            raise ValueError('请输入至少两个字符的商品关键词')
        return value


def jd_service(request: Request):
    return JDSearchService(request.app.state.database, request.app.state.jd_client)


def pool_service(request: Request):
    return JDPoolService(request.app.state.database, request.app.state.jd_client)


class JDCollectRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    pages: int = Field(default=3, ge=1, le=30)


@router.post('/jd/pool/collect')
def jd_pool_collect(body: JDCollectRequest, request: Request):
    try:
        return pool_service(request).collect(body.pages)
    except JDError as error:
        raise HTTPException(status_code=error.status, detail={'message': str(error), 'code': error.code}) from None


@router.get('/jd/catalog')
def jd_catalog(request: Request, category: str, q: str = Query(default='', max_length=100), page: int = Query(default=1, ge=1, le=500)):
    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail='未知的配件类别')
    return pool_service(request).catalog(category, q.strip(), page)


@router.get('/jd/pool/latest')
def jd_pool_latest(request: Request):
    return pool_service(request).run()


@router.get('/jd/catalog/{product_id}/history')
def jd_price_history(product_id: str, request: Request):
    result = pool_service(request).history(product_id)
    if result is None:
        raise HTTPException(status_code=404, detail='商品未找到')
    return result


class JDCompareRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    category: str = Field(min_length=1, max_length=20)
    brand: str = Field(min_length=1, max_length=100)
    modelName: str = Field(min_length=3, max_length=200)
    specs: str = Field(max_length=500)


class JDCompareHistoryRequest(JDCompareRequest):
    offerId: str = Field(min_length=1, max_length=100)


class MarketCompareRequest(JDCompareRequest):
    page: int = Field(default=1, ge=1, le=500)
    platform: str = Field(default='all', pattern=r'^(all|jd|taobao)$')


@router.post('/market/compare')
def market_compare(body: MarketCompareRequest, request: Request):
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=422, detail='未知的配件类别')
    return MarketComparisonService(request.app.state.database).compare(
        body.category, body.brand, body.modelName, body.specs, body.page, body.platform)


@router.post('/jd/compare')
def jd_compare(body: JDCompareRequest, request: Request):
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=422, detail='未知的配件类别')
    return JDComparisonService(request.app.state.database).compare(body.category, body.brand, body.modelName, body.specs)


@router.post('/jd/compare/history')
def jd_compare_history(body: JDCompareHistoryRequest, request: Request):
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=422, detail='未知的配件类别')
    result = JDComparisonService(request.app.state.database).history(body.category, body.brand, body.modelName, body.specs, body.offerId)
    if result is None:
        raise HTTPException(status_code=404, detail='当前型号未找到该店铺报价')
    return result


class JDDetailRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    inputs: str = Field(min_length=1, max_length=6000)
    collectionKey: str = Field(min_length=1, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')


@router.post('/jd/details')
def jd_details(body: JDDetailRequest, request: Request):
    try:
        sku_ids = parse_sku_inputs(body.inputs)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    try:
        return jd_service(request).details(sku_ids, body.collectionKey)
    except JDError as error:
        raise HTTPException(status_code=error.status, detail={'message': str(error), 'code': error.code}) from None


@router.get('/jd/details')
def jd_cached_details(request: Request, collection_key: str = Query(alias='collectionKey', min_length=1, max_length=80, pattern=r'^[A-Za-z0-9_-]+$')):
    return jd_service(request).cached_details(collection_key)


@router.get('/jd/status')
def jd_status(request: Request):
    return {'configured': request.app.state.jd_client.configured, 'method': METHOD, 'detailMethod': DETAIL_METHOD}


@router.post('/jd/search')
def jd_search(body: JDSearchRequest, request: Request):
    try:
        return jd_service(request).search(body.keyword, body.page, body.page_size)
    except JDError as error:
        raise HTTPException(status_code=error.status, detail={'message': str(error), 'code': error.code}) from None


@router.get('/jd/search')
def jd_cached_search(request: Request, keyword: str = Query(min_length=2, max_length=120),
                     page: int = Query(default=1, ge=1, le=100),
                     page_size: int = Query(default=20, ge=1, le=50, alias='pageSize')):
    keyword = ' '.join(keyword.split())
    if len(keyword) < 2:
        raise HTTPException(status_code=422, detail='请输入至少两个字符的商品关键词')
    return jd_service(request).cached(keyword, page, page_size)


@router.get('/jd/tasks/{task_id}')
def jd_task(task_id: str, request: Request):
    result = jd_service(request).get(task_id)
    if result is None:
        raise HTTPException(status_code=404, detail='Task not found')
    return result


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/hardware", response_model=list[HardwareResponse])
def hardware(request: Request):
    return request.app.state.database.list_hardware()


@router.get("/hardware/{hardware_id}/offers", response_model=list[OfferResponse])
def offers(hardware_id: str, request: Request):
    database = request.app.state.database
    if not database.hardware_exists(hardware_id):
        raise HTTPException(status_code=404, detail="Hardware not found")
    return database.list_offers(hardware_id)
