from pydantic import BaseModel


class SatellitePosition(BaseModel):
    name: str
    lat: float
    lon: float
    alt_km: float
    x_km: float
    y_km: float
    z_km: float
    risk: str


class SatelliteSummary(BaseModel):
    name: str
    lat: float
    lon: float
    alt_km: float
    risk: str


class CollisionEvent(BaseModel):
    satellite_1: str
    satellite_2: str
    distance_km: float
    risk: str
    timestamp: str
    dx: float
    dy: float
    dz: float
    dvx: float
    dvy: float
    dvz: float
    current_distance_km: float
    altitude_diff_km: float


class CollisionSummary(BaseModel):
    satellite_1: str
    satellite_2: str
    distance_km: float
    risk: str
    timestamp: str


class MLPrediction(BaseModel):
    satellite_1: str
    satellite_2: str
    predicted_min_distance_km: float
    predicted_risk: str
