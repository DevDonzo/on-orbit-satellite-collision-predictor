from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OrbitalTelemetry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    object_id: str = Field(min_length=1, max_length=64)
    eccentricity: float = Field(ge=0.0, lt=1.0)
    inclination_deg: float = Field(ge=0.0, le=180.0)
    raan_deg: float = Field(ge=0.0, lt=360.0)
    arg_perigee_deg: float = Field(ge=0.0, lt=360.0)
    mean_anomaly_deg: float = Field(ge=0.0, lt=360.0)
    mean_motion_rev_per_day: float = Field(gt=0.0)
    bstar: float | None = None


class CollisionPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    object_a: OrbitalTelemetry
    object_b: OrbitalTelemetry
    closest_approach_km: float | None = Field(default=None, gt=0.0)
    relative_velocity_kms: float | None = Field(default=None, gt=0.0)

    @model_validator(mode="after")
    def _validate_unique_object_pair(self) -> "CollisionPredictionRequest":
        if self.object_a.object_id == self.object_b.object_id:
            raise ValueError("object_a and object_b must be different spacecraft objects.")
        return self

    def to_feature_row(self) -> dict[str, Any]:
        return {
            "a_eccentricity": self.object_a.eccentricity,
            "a_inclination_deg": self.object_a.inclination_deg,
            "a_raan_deg": self.object_a.raan_deg,
            "a_arg_perigee_deg": self.object_a.arg_perigee_deg,
            "a_mean_anomaly_deg": self.object_a.mean_anomaly_deg,
            "a_mean_motion_rev_per_day": self.object_a.mean_motion_rev_per_day,
            "b_eccentricity": self.object_b.eccentricity,
            "b_inclination_deg": self.object_b.inclination_deg,
            "b_raan_deg": self.object_b.raan_deg,
            "b_arg_perigee_deg": self.object_b.arg_perigee_deg,
            "b_mean_anomaly_deg": self.object_b.mean_anomaly_deg,
            "b_mean_motion_rev_per_day": self.object_b.mean_motion_rev_per_day,
            "closest_approach_km": self.closest_approach_km,
            "relative_velocity_kms": self.relative_velocity_kms,
        }


class CollisionPredictionResponse(BaseModel):
    collision_probability: float = Field(ge=0.0, le=1.0)
    collision_risk_band: str
    decision_threshold: float = Field(gt=0.0, lt=1.0)
    model_version: str
    cached: bool = False


class BatchCollisionPredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    events: list[CollisionPredictionRequest] = Field(min_length=1, max_length=1000)


class BatchCollisionPredictionResponse(BaseModel):
    predictions: list[CollisionPredictionResponse]
    model_version: str


class TLEIngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tle_text: str = Field(min_length=10)


class CDMIngestionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    object_a: OrbitalTelemetry
    object_b: OrbitalTelemetry
    closest_approach_km: float | None = Field(default=None, gt=0.0)
    relative_velocity_kms: float | None = Field(default=None, gt=0.0)
    collision_event: int | None = Field(default=None, ge=0, le=1)


class CDMIngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    records: list[CDMIngestionRecord] = Field(min_length=1, max_length=20000)


class IngestionResponse(BaseModel):
    kind: str
    records_cached: int
    cache_key: str
    ttl_seconds: int
