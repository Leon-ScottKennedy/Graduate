from contextlib import asynccontextmanager
from fastapi import FastAPI
from .api.routes import router
from .config import Settings
from .repositories.database import Database
from .integrations.jd.client import JDClient
from .api.ai import router as ai_router, AIService
from .api.quotes import router as quotes_router
from .api.taobao import router as taobao_router
from .integrations.taobao import TaobaoClient
from .ingestion.taobao_search import TaobaoSearchService


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or Settings.from_environment()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database = Database(configuration.database_path)
        database.initialize()
        app.state.database = database
        app.state.jd_client = JDClient(configuration)
        app.state.ai_service = AIService(configuration)
        app.state.taobao_client = TaobaoClient(configuration)
        app.state.taobao_search = TaobaoSearchService(database, app.state.taobao_client)
        yield

    application = FastAPI(title="NexBuild API", lifespan=lifespan)
    application.include_router(router)
    application.include_router(ai_router)
    application.include_router(quotes_router)
    application.include_router(taobao_router)
    return application


app = create_app()
