import numpy as np
import pandas as pd

from ml.feature_engineering import PairFeatureEngineer


def test_pair_feature_engineering_outputs_advanced_features() -> None:
    frame = pd.DataFrame(
        [
            {
                "a_eccentricity": 0.001,
                "a_inclination_deg": 98.2,
                "a_raan_deg": 120.1,
                "a_arg_perigee_deg": 250.0,
                "a_mean_anomaly_deg": 10.2,
                "a_mean_motion_rev_per_day": 14.2,
                "b_eccentricity": 0.002,
                "b_inclination_deg": 97.9,
                "b_raan_deg": 121.5,
                "b_arg_perigee_deg": 245.0,
                "b_mean_anomaly_deg": 9.8,
                "b_mean_motion_rev_per_day": 14.3,
                "closest_approach_km": 1.2,
                "relative_velocity_kms": 12.5,
            }
        ]
    )

    transformed = PairFeatureEngineer().fit(frame).transform(frame)
    required = {
        "delta_orbital_period_min",
        "mean_altitude_km",
        "delta_altitude_km",
        "plane_separation_score",
        "relative_energy_proxy",
    }
    assert required.issubset(set(transformed.columns))
    assert np.isfinite(transformed["mean_altitude_km"].iloc[0])
