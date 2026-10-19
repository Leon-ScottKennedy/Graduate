from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from ..cleaning.jd_goods import clean_text
from ..integrations.taobao import TaobaoError, SEARCH_METHOD

router = APIRouter(prefix='/api/taobao')


class Search(BaseModel):
    model_config = ConfigDict(extra='forbid')
    keyword: str = Field(min_length=2, max_length=120)
    page: int = Field(default=1, ge=1, le=100)
    pageSize: int = Field(default=20, ge=1, le=40)

    @field_validator('keyword')
    @classmethod
    def normalize(cls, value):
        value = clean_text(value)
        if len(value) < 2 or '://' in value:
            raise ValueError('请输入硬件型号关键词，不要输入商品链接')
        return value


@router.get('/status')
def status(request: Request):
    return dict(configured=request.app.state.taobao_client.search_configured, method=SEARCH_METHOD)


@router.post('/search')
def search(body: Search, request: Request):
    try:
        return request.app.state.taobao_search.search(body.keyword, body.page, body.pageSize)
    except TaobaoError as error:
        raise HTTPException(503, str(error)) from None


@router.get('/search')
def cached(request: Request, keyword: str = Query(min_length=2, max_length=120), page: int = Query(default=1, ge=1, le=100), pageSize: int = Query(default=20, ge=1, le=40)):
    try:
        body = Search(keyword=keyword, page=page, pageSize=pageSize)
    except ValueError:
        raise HTTPException(422, '查询条件无效') from None
    return request.app.state.taobao_search.cached(body.keyword, page, pageSize)
