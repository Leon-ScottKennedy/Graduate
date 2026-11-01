from contextlib import asynccontextmanager
import threading
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from .api.routes import router
from .config import Settings
from .repositories.database import Database
from .integrations.jd.client import JDClient
from .api.ai import router as ai_router, AIService
from .api.quotes import router as quotes_router
from .api.taobao import router as taobao_router
from .integrations.taobao import TaobaoClient
from .ingestion.taobao_search import TaobaoSearchService
from .api.recommendations import router as recommendations_router
from .api.alternatives import router as alternatives_router
from .security import SecurityMiddleware, SecurityStore
from .api.auth import router as auth_router, AccountService


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or Settings.from_environment()
    database = Database(configuration.database_path)
    security = SecurityStore(database, configuration)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database.initialize()
        app.state.database = database
        app.state.accounts = AccountService(database, configuration, security)
        app.state.jd_client = JDClient(configuration)
        app.state.jd_client.before_request = security.consume_vendor_call
        app.state.ai_service = AIService(configuration)
        app.state.ai_service.before_request = security.consume_ai_call
        app.state.taobao_client = TaobaoClient(configuration)
        app.state.taobao_client.before_request = security.consume_vendor_call
        app.state.taobao_search = TaobaoSearchService(database, app.state.taobao_client)
        app.state.candidate_collection_lock = threading.Lock()
        app.state.candidate_collection_attempts = {}
        yield

    production = configuration.security_mode == 'production'
    application = FastAPI(title="NexBuild API", lifespan=lifespan,
                          docs_url=None if production else '/docs',
                          redoc_url=None if production else '/redoc',
                          openapi_url=None if production else '/openapi.json')
    application.state.security = security
    application.add_middleware(SecurityMiddleware, settings=configuration, store=security)
    if configuration.allowed_origins:
        application.add_middleware(CORSMiddleware, allow_origins=list(configuration.allowed_origins),
                                   allow_methods=['GET', 'HEAD', 'POST', 'DELETE'],
                                   allow_headers=['Authorization', 'Content-Type'],
                                   expose_headers=['Retry-After'], allow_credentials=True)
    if production:
        @application.exception_handler(RequestValidationError)
        async def invalid_request(request, error):
            return JSONResponse({'detail': '请求字段无效，请检查输入内容'}, status_code=422)

        @application.exception_handler(HTTPException)
        async def safe_error(request, error):
            detail = '在线服务暂不可用，请稍后重试或联系管理员' if error.status_code >= 500 else error.detail
            return JSONResponse({'detail': detail}, status_code=error.status_code, headers=error.headers)
    application.include_router(router)
    application.include_router(auth_router)
    application.include_router(ai_router)
    application.include_router(recommendations_router)
    application.include_router(alternatives_router)
    application.include_router(quotes_router)
    application.include_router(taobao_router)
    return application


app = create_app()
