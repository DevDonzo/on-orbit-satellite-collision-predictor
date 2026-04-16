from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from api.routes import auth_router, v1_router
from core.cache import build_cache_client
from core.config import settings
from ml.predictor import CollisionPredictor

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.cache_client = build_cache_client()
    model_path = Path(settings.model_artifact_path)
    app.state.predictor = None
    if model_path.exists():
        app.state.predictor = CollisionPredictor.from_artifact(model_path)
    else:
        logger.warning("Model artifact not found at %s. /v1/predict will return 503.", model_path)
    yield
    await app.state.cache_client.close()


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(v1_router)


@app.get("/healthz")
async def healthcheck() -> dict[str, object]:
    return {
        "status": "ok",
        "environment": settings.environment,
        "model_loaded": app.state.predictor is not None,
    }


@app.get("/readyz")
async def readiness() -> JSONResponse:
    if app.state.predictor is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "reason": "model_not_loaded"},
        )
    return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "ready"})


@app.exception_handler(ValueError)
async def handle_value_error(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc)},
    )
