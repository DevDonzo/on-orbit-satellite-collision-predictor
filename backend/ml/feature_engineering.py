from __future__ import annotations

import pandas as pd

FEATURE_COLUMNS = [
    "dx",
    "dy",
    "dz",
    "dvx",
    "dvy",
    "dvz",
    "current_distance_km",
    "altitude_diff_km",
]


def create_feature_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    return df[FEATURE_COLUMNS].copy()


def fit_normalizer(features: pd.DataFrame) -> dict[str, dict[str, float]]:
    means = features.mean().to_dict()
    stds = features.std(ddof=0).replace(0.0, 1.0).to_dict()
    return {"mean": {k: float(v) for k, v in means.items()}, "std": {k: float(v) for k, v in stds.items()}}


def apply_normalization(features: pd.DataFrame, stats: dict[str, dict[str, float]]) -> pd.DataFrame:
    normalized = features.copy()
    for col in FEATURE_COLUMNS:
        normalized[col] = (normalized[col] - stats["mean"][col]) / stats["std"][col]
    return normalized
