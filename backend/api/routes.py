from fastapi import APIRouter, HTTPException

from ml.data_pipeline import (
    build_current_satellite_positions,
    build_predict_rows_from_collisions,
    compute_collision_candidates,
)
from ml.predictor import OptionalMLPredictor
from ml.schemas import CollisionSummary, MLPrediction, SatelliteSummary

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/satellites", response_model=list[SatelliteSummary])
def get_satellites() -> list[SatelliteSummary]:
    positions = build_current_satellite_positions()
    return [
        SatelliteSummary(
            name=item.name,
            lat=float(item.lat),
            lon=float(item.lon),
            alt_km=float(item.alt_km),
            risk=item.risk,
        )
        for item in positions
    ]


@router.get("/collisions", response_model=list[CollisionSummary])
def get_collisions() -> list[CollisionSummary]:
    collisions = compute_collision_candidates()
    return [
        CollisionSummary(
            satellite_1=item.satellite_1,
            satellite_2=item.satellite_2,
            distance_km=float(item.distance_km),
            risk=item.risk,
            timestamp=item.timestamp,
        )
        for item in collisions
    ]


@router.get("/predict", response_model=list[MLPrediction])
def get_optional_predictions() -> list[MLPrediction]:
    predictor = OptionalMLPredictor()
    if not predictor.available:
        raise HTTPException(
            status_code=503,
            detail="ML model not available. Train a model first with train_model.py",
        )

    collisions = compute_collision_candidates()
    rows = build_predict_rows_from_collisions(collisions)
    predicted_distances = predictor.predict_min_distance(rows)

    output: list[MLPrediction] = []
    for event, predicted_distance in zip(collisions, predicted_distances):
        output.append(
            MLPrediction(
                satellite_1=event.satellite_1,
                satellite_2=event.satellite_2,
                predicted_min_distance_km=round(float(predicted_distance), 3),
                predicted_risk=predictor.distance_to_risk(float(predicted_distance)),
            )
        )
    return output
