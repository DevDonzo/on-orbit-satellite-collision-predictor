from __future__ import annotations

from datetime import timedelta
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from core.auth import (
    Token,
    User,
    authenticate_user,
    create_access_token,
    get_access_token_ttl_seconds,
    get_current_active_user,
)
from core.cache import CacheClient
from core.config import settings
from ml.data_pipeline import cdm_records_to_pair_dataframe, pair_tle_objects, parse_tle_text
from ml.predictor import CollisionPredictor
from ml.schemas import (
    BatchCollisionPredictionRequest,
    BatchCollisionPredictionResponse,
    CDMIngestionRequest,
    CollisionPredictionRequest,
    CollisionPredictionResponse,
    IngestionResponse,
    TLEIngestionRequest,
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])
v1_router = APIRouter(prefix="/v1", tags=["collision"])


def get_cache_client(request: Request) -> CacheClient:
    cache = getattr(request.app.state, "cache_client", None)
    if cache is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cache not initialized.")
    return cache


def get_predictor(request: Request) -> CollisionPredictor:
    predictor = getattr(request.app.state, "predictor", None)
    if predictor is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded. Train and serialize a model first.",
        )
    return predictor


def _risk_band(probability: float, threshold: float) -> str:
    if probability >= max(0.8, threshold * 1.5):
        return "critical"
    if probability >= threshold:
        return "high"
    if probability >= (threshold * 0.5):
        return "moderate"
    return "low"


async def get_rate_limited_user(
    current_user: Annotated[User, Depends(get_current_active_user)],
    cache: Annotated[CacheClient, Depends(get_cache_client)],
) -> User:
    minute_bucket = int(time.time() // 60)
    key = f"rate_limit:{current_user.username}:{minute_bucket}"
    count = await cache.increment(key=key, amount=1, ttl_seconds=70)
    if count > settings.auth_rate_limit_per_minute:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for authenticated user.",
        )
    return current_user


@auth_router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_expiry = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=token_expiry)
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=get_access_token_ttl_seconds(),
    )


@v1_router.post("/predict", response_model=CollisionPredictionResponse)
async def predict_collision(
    payload: CollisionPredictionRequest,
    _current_user: Annotated[User, Depends(get_rate_limited_user)],
    cache: Annotated[CacheClient, Depends(get_cache_client)],
    predictor: Annotated[CollisionPredictor, Depends(get_predictor)],
) -> CollisionPredictionResponse:
    feature_row = payload.to_feature_row()
    cache_key = CacheClient.make_key("prediction", feature_row)
    cached = await cache.get(cache_key)
    if cached is not None:
        return CollisionPredictionResponse(
            collision_probability=cached["collision_probability"],
            collision_risk_band=cached["collision_risk_band"],
            decision_threshold=cached["decision_threshold"],
            model_version=cached["model_version"],
            cached=True,
        )

    probability = predictor.predict_probability(feature_row)
    threshold = predictor.probability_threshold
    response_payload = {
        "collision_probability": probability,
        "collision_risk_band": _risk_band(probability=probability, threshold=threshold),
        "decision_threshold": threshold,
        "model_version": predictor.model_version,
    }
    await cache.set(cache_key, response_payload, ttl_seconds=settings.cache_ttl_seconds)
    return CollisionPredictionResponse(cached=False, **response_payload)


@v1_router.post("/predict/batch", response_model=BatchCollisionPredictionResponse)
async def predict_collision_batch(
    payload: BatchCollisionPredictionRequest,
    _current_user: Annotated[User, Depends(get_rate_limited_user)],
    cache: Annotated[CacheClient, Depends(get_cache_client)],
    predictor: Annotated[CollisionPredictor, Depends(get_predictor)],
) -> BatchCollisionPredictionResponse:
    threshold = predictor.probability_threshold
    predictions: list[CollisionPredictionResponse | None] = [None] * len(payload.events)
    missing_rows: list[dict[str, float | None]] = []
    missing_indices: list[int] = []
    missing_cache_keys: list[str] = []

    for idx, event in enumerate(payload.events):
        feature_row = event.to_feature_row()
        cache_key = CacheClient.make_key("prediction", feature_row)
        cached = await cache.get(cache_key)
        if cached is not None:
            predictions[idx] = CollisionPredictionResponse(
                collision_probability=cached["collision_probability"],
                collision_risk_band=cached["collision_risk_band"],
                decision_threshold=cached["decision_threshold"],
                model_version=cached["model_version"],
                cached=True,
            )
            continue
        missing_rows.append(feature_row)
        missing_indices.append(idx)
        missing_cache_keys.append(cache_key)

    if missing_rows:
        probabilities = predictor.predict_probabilities(missing_rows)
        for idx, probability, cache_key in zip(missing_indices, probabilities, missing_cache_keys):
            response_payload = {
                "collision_probability": probability,
                "collision_risk_band": _risk_band(probability=probability, threshold=threshold),
                "decision_threshold": threshold,
                "model_version": predictor.model_version,
            }
            await cache.set(cache_key, response_payload, ttl_seconds=settings.cache_ttl_seconds)
            predictions[idx] = CollisionPredictionResponse(cached=False, **response_payload)

    return BatchCollisionPredictionResponse(
        predictions=[item for item in predictions if item is not None],
        model_version=predictor.model_version,
    )


@v1_router.get("/model/metadata")
async def get_model_metadata(
    _current_user: Annotated[User, Depends(get_rate_limited_user)],
    predictor: Annotated[CollisionPredictor, Depends(get_predictor)],
) -> dict[str, object]:
    return {
        "model_version": predictor.model_version,
        "decision_threshold": predictor.probability_threshold,
        "metadata": predictor.metadata,
    }


@v1_router.post("/ingest/tle", response_model=IngestionResponse)
async def ingest_tle(
    payload: TLEIngestionRequest,
    _current_user: Annotated[User, Depends(get_rate_limited_user)],
    cache: Annotated[CacheClient, Depends(get_cache_client)],
) -> IngestionResponse:
    cache_key = CacheClient.make_key("tle_payload", {"tle_text": payload.tle_text})
    cached = await cache.get(cache_key)
    if cached is None:
        tle_df = parse_tle_text(payload.tle_text)
        pair_df = pair_tle_objects(
            tle_df,
            strategy=settings.tle_pairing_strategy,
            max_pairs=settings.max_tle_pairs,
        )
        await cache.set(
            cache_key,
            pair_df.to_dict(orient="records"),
            ttl_seconds=settings.parsed_dataset_ttl_seconds,
        )
        count = len(pair_df)
    else:
        count = len(cached)

    return IngestionResponse(
        kind="tle",
        records_cached=count,
        cache_key=cache_key,
        ttl_seconds=settings.parsed_dataset_ttl_seconds,
    )


@v1_router.post("/ingest/cdm", response_model=IngestionResponse)
async def ingest_cdm(
    payload: CDMIngestionRequest,
    _current_user: Annotated[User, Depends(get_rate_limited_user)],
    cache: Annotated[CacheClient, Depends(get_cache_client)],
) -> IngestionResponse:
    payload_dump = payload.model_dump()
    cache_key = CacheClient.make_key("cdm_payload", payload_dump)
    cached = await cache.get(cache_key)
    if cached is None:
        cdm_df = cdm_records_to_pair_dataframe(payload_dump["records"])
        await cache.set(
            cache_key,
            cdm_df.to_dict(orient="records"),
            ttl_seconds=settings.parsed_dataset_ttl_seconds,
        )
        count = len(cdm_df)
    else:
        count = len(cached)

    return IngestionResponse(
        kind="cdm",
        records_cached=count,
        cache_key=cache_key,
        ttl_seconds=settings.parsed_dataset_ttl_seconds,
    )
