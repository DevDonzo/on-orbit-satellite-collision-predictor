from __future__ import annotations

from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Any

import numpy as np
import pandas as pd
from skyfield.api import EarthSatellite, load, wgs84

import core.config as config
from ml.schemas import CollisionEvent, SatellitePosition

_TS = load.timescale()


def _get_cfg_value(name: str, settings_name: str, default: float) -> float:
    if hasattr(config, name):
        return float(getattr(config, name))
    if hasattr(config, "settings") and hasattr(config.settings, settings_name):
        return float(getattr(config.settings, settings_name))
    return float(default)


def _time_step_seconds() -> int:
    value = int(_get_cfg_value("TIME_STEP_SECONDS", "simulation_step_seconds", 300))
    return max(1, value)


def _prediction_hours() -> int:
    value = int(_get_cfg_value("PREDICTION_HOURS", "simulation_horizon_hours", 6))
    return max(1, value)


def _danger_distance_km() -> float:
    return _get_cfg_value("DANGER_DISTANCE_KM", "danger_distance_km", 10.0)


def _warning_distance_km() -> float:
    return _get_cfg_value("WARNING_DISTANCE_KM", "warning_distance_km", 50.0)


def _classify_risk(distance_km: float) -> str:
    if distance_km < _danger_distance_km():
        return "danger"
    if distance_km < _warning_distance_km():
        return "warning"
    return "safe"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_satellites() -> list[EarthSatellite]:
    sample_tles = getattr(config, "SAMPLE_TLES", [])
    satellites: list[EarthSatellite] = []
    for item in sample_tles:
        try:
            satellites.append(EarthSatellite(item["line1"], item["line2"], item["name"], _TS))
        except Exception:
            continue
    return satellites


def _satellite_state(satellite: EarthSatellite, when: datetime) -> dict[str, Any]:
    t = _TS.from_datetime(when)
    geocentric = satellite.at(t)
    subpoint = wgs84.subpoint(geocentric)
    xyz = geocentric.position.km
    velocity = geocentric.velocity.km_per_s
    return {
        "name": satellite.name,
        "lat": float(subpoint.latitude.degrees),
        "lon": float(subpoint.longitude.degrees),
        "alt_km": float(subpoint.elevation.km),
        "x_km": float(xyz[0]),
        "y_km": float(xyz[1]),
        "z_km": float(xyz[2]),
        "vx_km_s": float(velocity[0]),
        "vy_km_s": float(velocity[1]),
        "vz_km_s": float(velocity[2]),
    }


def _distance_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    vec_a = np.array([a["x_km"], a["y_km"], a["z_km"]], dtype=float)
    vec_b = np.array([b["x_km"], b["y_km"], b["z_km"]], dtype=float)
    return float(max(0.0, np.linalg.norm(vec_a - vec_b)))


def _future_times(start: datetime) -> list[datetime]:
    step_seconds = _time_step_seconds()
    total_seconds = _prediction_hours() * 3600
    steps = max(1, int(total_seconds // step_seconds))
    return [start + timedelta(seconds=i * step_seconds) for i in range(steps + 1)]


def build_current_satellite_positions() -> list[SatellitePosition]:
    satellites = _build_satellites()
    if not satellites:
        return []
    now = _utc_now()
    states: list[dict[str, Any]] = []
    for sat in satellites:
        try:
            state = _satellite_state(sat, now)
            if all(np.isfinite([state["lat"], state["lon"], state["alt_km"], state["x_km"], state["y_km"], state["z_km"]])):
                states.append(state)
        except Exception:
            continue
    if not states:
        return []
    out: list[SatellitePosition] = []

    for i, state_i in enumerate(states):
        nearest = float("inf")
        for j, state_j in enumerate(states):
            if i == j:
                continue
            nearest = min(nearest, _distance_km(state_i, state_j))
        if not np.isfinite(nearest):
            nearest = float("inf")
        out.append(
            SatellitePosition(
                name=state_i["name"],
                lat=round(state_i["lat"], 6),
                lon=round(state_i["lon"], 6),
                alt_km=round(state_i["alt_km"], 3),
                x_km=round(state_i["x_km"], 3),
                y_km=round(state_i["y_km"], 3),
                z_km=round(state_i["z_km"], 3),
                risk=_classify_risk(nearest),
            )
        )
    return out


def compute_collision_candidates() -> list[CollisionEvent]:
    satellites = _build_satellites()
    if len(satellites) < 2:
        return []
    now = _utc_now()
    future_times = _future_times(now)
    output: list[CollisionEvent] = []

    for sat_a, sat_b in combinations(satellites, 2):
        try:
            min_distance = float("inf")
            min_time = now
            current_a = _satellite_state(sat_a, now)
            current_b = _satellite_state(sat_b, now)
            current_distance = _distance_km(current_a, current_b)
        except Exception:
            continue

        for step_time in future_times:
            try:
                state_a = _satellite_state(sat_a, step_time)
                state_b = _satellite_state(sat_b, step_time)
                distance = _distance_km(state_a, state_b)
            except Exception:
                continue
            if distance < min_distance:
                min_distance = distance
                min_time = step_time

        if not np.isfinite(min_distance):
            continue

        output.append(
            CollisionEvent(
                satellite_1=sat_a.name,
                satellite_2=sat_b.name,
                distance_km=round(min_distance, 3),
                risk=_classify_risk(min_distance),
                timestamp=min_time.isoformat().replace("+00:00", "Z"),
                dx=round(current_b["x_km"] - current_a["x_km"], 6),
                dy=round(current_b["y_km"] - current_a["y_km"], 6),
                dz=round(current_b["z_km"] - current_a["z_km"], 6),
                dvx=round(current_b["vx_km_s"] - current_a["vx_km_s"], 6),
                dvy=round(current_b["vy_km_s"] - current_a["vy_km_s"], 6),
                dvz=round(current_b["vz_km_s"] - current_a["vz_km_s"], 6),
                current_distance_km=round(current_distance, 6),
                altitude_diff_km=round(abs(current_b["alt_km"] - current_a["alt_km"]), 6),
            )
        )
    return output


def build_predict_rows_from_collisions(collisions: list[CollisionEvent]) -> list[dict[str, float]]:
    return [
        {
            "dx": event.dx,
            "dy": event.dy,
            "dz": event.dz,
            "dvx": event.dvx,
            "dvy": event.dvy,
            "dvz": event.dvz,
            "current_distance_km": event.current_distance_km,
            "altitude_diff_km": event.altitude_diff_km,
        }
        for event in collisions
    ]


def generate_training_dataframe(samples_per_pair: int = 12, offset_minutes: int = 10) -> pd.DataFrame:
    satellites = _build_satellites()
    if len(satellites) < 2:
        return pd.DataFrame(
            columns=[
                "dx",
                "dy",
                "dz",
                "dvx",
                "dvy",
                "dvz",
                "current_distance_km",
                "altitude_diff_km",
                "label_min_distance_km",
            ]
        )
    base_time = _utc_now()
    rows: list[dict[str, float]] = []

    for sat_a, sat_b in combinations(satellites, 2):
        for idx in range(samples_per_pair):
            start_time = base_time + timedelta(minutes=idx * offset_minutes)
            current_a = _satellite_state(sat_a, start_time)
            current_b = _satellite_state(sat_b, start_time)
            min_distance = float("inf")

            for step_time in _future_times(start_time):
                step_a = _satellite_state(sat_a, step_time)
                step_b = _satellite_state(sat_b, step_time)
                min_distance = min(min_distance, _distance_km(step_a, step_b))

            rows.append(
                {
                    "dx": current_b["x_km"] - current_a["x_km"],
                    "dy": current_b["y_km"] - current_a["y_km"],
                    "dz": current_b["z_km"] - current_a["z_km"],
                    "dvx": current_b["vx_km_s"] - current_a["vx_km_s"],
                    "dvy": current_b["vy_km_s"] - current_a["vy_km_s"],
                    "dvz": current_b["vz_km_s"] - current_a["vz_km_s"],
                    "current_distance_km": _distance_km(current_a, current_b),
                    "altitude_diff_km": abs(current_b["alt_km"] - current_a["alt_km"]),
                    "label_min_distance_km": min_distance,
                }
            )
    return pd.DataFrame(rows)
