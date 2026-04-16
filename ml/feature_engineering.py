from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

from ml.data_pipeline import OPTIONAL_RAW_COLUMNS, REQUIRED_RAW_COLUMNS

MU_EARTH_KM3_S2 = 398600.4418
EARTH_EQUATORIAL_RADIUS_KM = 6378.137


def _angular_delta_deg(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Compute wrapped absolute angular separation in degrees on [0, 180]."""
    return np.abs((a - b + 180.0) % 360.0 - 180.0)


def _mean_motion_to_semi_major_axis_km(mean_motion_rev_per_day: np.ndarray) -> np.ndarray:
    """
    Convert mean motion to semi-major axis using two-body Keplerian dynamics.

    Assumption:
    - We model each orbit as a Keplerian two-body ellipse around Earth.
    - Mean motion n is interpreted in radians/second.
    - Semi-major axis follows n = sqrt(mu / a^3), therefore a = (mu / n^2)^(1/3).
    """

    n_rad_s = mean_motion_rev_per_day * (2.0 * np.pi / 86400.0)
    return np.cbrt(MU_EARTH_KM3_S2 / np.square(n_rad_s))


class PairFeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Derive conjunction risk features from paired orbital elements.

    Mathematical assumptions:
    1. Orbital states are represented by mean Keplerian elements at a common epoch.
    2. Collision likelihood increases when orbital planes, argument geometry, and
       radial shells are similar, so wrapped angular separations are used for all
       circular quantities (RAAN, argument of perigee, mean anomaly).
    3. Mean motion is transformed into semi-major axis using the Earth two-body
       relation to capture radial shell spacing.
    4. Perigee/apogee shell overlap is used as a coarse proxy for radial coexistence.
    5. Optional encounter context (closest approach distance and relative speed)
       is included when available, while missing values are imputed upstream.
    """

    feature_names_: np.ndarray

    def fit(self, X: pd.DataFrame, y: np.ndarray | None = None) -> "PairFeatureEngineer":
        self.feature_names_ = np.array(
            [
                "mean_eccentricity",
                "delta_eccentricity",
                "delta_inclination_deg",
                "delta_raan_deg",
                "delta_arg_perigee_deg",
                "delta_mean_anomaly_deg",
                "a_semi_major_axis_km",
                "b_semi_major_axis_km",
                "delta_semi_major_axis_km",
                "a_orbital_period_min",
                "b_orbital_period_min",
                "delta_orbital_period_min",
                "mean_altitude_km",
                "delta_altitude_km",
                "radial_shell_overlap_km",
                "delta_perigee_km",
                "delta_apogee_km",
                "plane_separation_score",
                "relative_energy_proxy",
                "closest_approach_km",
                "relative_velocity_kms",
                "conjunction_pressure",
            ],
            dtype=object,
        )
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        df = pd.DataFrame(X).copy()
        missing = [col for col in REQUIRED_RAW_COLUMNS if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required raw columns for feature engineering: {missing}")

        for col in REQUIRED_RAW_COLUMNS + OPTIONAL_RAW_COLUMNS:
            if col not in df.columns:
                df[col] = np.nan
            df[col] = pd.to_numeric(df[col], errors="coerce")

        a_sma = _mean_motion_to_semi_major_axis_km(df["a_mean_motion_rev_per_day"].to_numpy())
        b_sma = _mean_motion_to_semi_major_axis_km(df["b_mean_motion_rev_per_day"].to_numpy())
        a_period_min = 1440.0 / df["a_mean_motion_rev_per_day"].to_numpy()
        b_period_min = 1440.0 / df["b_mean_motion_rev_per_day"].to_numpy()
        a_alt_km = a_sma - EARTH_EQUATORIAL_RADIUS_KM
        b_alt_km = b_sma - EARTH_EQUATORIAL_RADIUS_KM
        a_ecc = df["a_eccentricity"].to_numpy()
        b_ecc = df["b_eccentricity"].to_numpy()

        a_perigee = a_sma * (1.0 - a_ecc)
        b_perigee = b_sma * (1.0 - b_ecc)
        a_apogee = a_sma * (1.0 + a_ecc)
        b_apogee = b_sma * (1.0 + b_ecc)
        shell_overlap = np.maximum(0.0, np.minimum(a_apogee, b_apogee) - np.maximum(a_perigee, b_perigee))

        closest_approach = df["closest_approach_km"].to_numpy()
        relative_velocity = df["relative_velocity_kms"].to_numpy()
        conjunction_pressure = relative_velocity / np.maximum(closest_approach, 1e-3)
        delta_inclination_deg = np.abs(
            df["a_inclination_deg"].to_numpy() - df["b_inclination_deg"].to_numpy()
        )
        delta_raan_deg = _angular_delta_deg(df["a_raan_deg"].to_numpy(), df["b_raan_deg"].to_numpy())
        plane_separation_score = np.square(np.sin(np.deg2rad(delta_inclination_deg) / 2.0)) + np.square(
            np.sin(np.deg2rad(delta_raan_deg) / 2.0)
        )
        relative_energy_proxy = np.abs((1.0 / a_sma) - (1.0 / b_sma))

        features = pd.DataFrame(
            {
                "mean_eccentricity": (a_ecc + b_ecc) / 2.0,
                "delta_eccentricity": np.abs(a_ecc - b_ecc),
                "delta_inclination_deg": delta_inclination_deg,
                "delta_raan_deg": delta_raan_deg,
                "delta_arg_perigee_deg": _angular_delta_deg(
                    df["a_arg_perigee_deg"].to_numpy(), df["b_arg_perigee_deg"].to_numpy()
                ),
                "delta_mean_anomaly_deg": _angular_delta_deg(
                    df["a_mean_anomaly_deg"].to_numpy(), df["b_mean_anomaly_deg"].to_numpy()
                ),
                "a_semi_major_axis_km": a_sma,
                "b_semi_major_axis_km": b_sma,
                "delta_semi_major_axis_km": np.abs(a_sma - b_sma),
                "a_orbital_period_min": a_period_min,
                "b_orbital_period_min": b_period_min,
                "delta_orbital_period_min": np.abs(a_period_min - b_period_min),
                "mean_altitude_km": (a_alt_km + b_alt_km) / 2.0,
                "delta_altitude_km": np.abs(a_alt_km - b_alt_km),
                "radial_shell_overlap_km": shell_overlap,
                "delta_perigee_km": np.abs(a_perigee - b_perigee),
                "delta_apogee_km": np.abs(a_apogee - b_apogee),
                "plane_separation_score": plane_separation_score,
                "relative_energy_proxy": relative_energy_proxy,
                "closest_approach_km": closest_approach,
                "relative_velocity_kms": relative_velocity,
                "conjunction_pressure": conjunction_pressure,
            }
        )
        return features

    def get_feature_names_out(self, input_features: np.ndarray | None = None) -> np.ndarray:
        return self.feature_names_
