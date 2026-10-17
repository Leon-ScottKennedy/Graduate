from contextlib import asynccontextmanager
from fastapi import FastAPI
from .api.routes import router
from .config import Settings
from .repositories.database import Database


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or Settings.from_environment()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database = Database(configuration.database_path)
        database.initialize()
        app.state.database = database
        yield

    application = FastAPI(title="NexBuild API", lifespan=lifespan)
    application.include_router(router)
    return application


app = create_app()
