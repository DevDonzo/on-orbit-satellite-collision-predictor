from fastapi import FastAPI

from api.routes import router
from core.config import settings

app = FastAPI(title=settings.api_title, version=settings.api_version)
app.include_router(router)
