import pandas as pd
import pytest

from ml.data_pipeline import pair_tle_objects, standardize_pair_dataset


def test_standardize_pair_dataset_from_nested_objects() -> None:
    source = pd.DataFrame(
        [
            {
                "object_a": {
                    "eccentricity": 0.001,
                    "inclination_deg": 98.2,
                    "raan_deg": 120.1,
                    "arg_perigee_deg": 250.0,
                    "mean_anomaly_deg": 10.2,
                    "mean_motion_rev_per_day": 14.2,
                },
                "object_b": {
                    "eccentricity": 0.002,
                    "inclination_deg": 97.9,
                    "raan_deg": 121.5,
                    "arg_perigee_deg": 245.0,
                    "mean_anomaly_deg": 9.8,
                    "mean_motion_rev_per_day": 14.3,
                },
                "closest_approach_km": 1.2,
                "relative_velocity_kms": 12.5,
                "collision_event": 1,
            }
        ]
    )
    normalized = standardize_pair_dataset(source, label_required=True)
    assert normalized.shape[0] == 1
    assert normalized["a_eccentricity"].iloc[0] == pytest.approx(0.001)
    assert normalized["b_mean_motion_rev_per_day"].iloc[0] == pytest.approx(14.3)
    assert normalized["collision_event"].iloc[0] == 1


def test_pair_tle_objects_all_pairs() -> None:
    tle_df = pd.DataFrame(
        {
            "object_id": ["A", "B", "C"],
            "eccentricity": [0.001, 0.002, 0.003],
            "inclination_deg": [98.0, 98.1, 98.2],
            "raan_deg": [10.0, 11.0, 12.0],
            "arg_perigee_deg": [20.0, 21.0, 22.0],
            "mean_anomaly_deg": [30.0, 31.0, 32.0],
            "mean_motion_rev_per_day": [14.2, 14.3, 14.4],
        }
    )
    paired = pair_tle_objects(tle_df, strategy="all_pairs", max_pairs=10)
    assert len(paired) == 3


def test_pair_tle_objects_limit_guard() -> None:
    tle_df = pd.DataFrame(
        {
            "object_id": ["A", "B", "C", "D"],
            "eccentricity": [0.001, 0.002, 0.003, 0.004],
            "inclination_deg": [98.0, 98.1, 98.2, 98.3],
            "raan_deg": [10.0, 11.0, 12.0, 13.0],
            "arg_perigee_deg": [20.0, 21.0, 22.0, 23.0],
            "mean_anomaly_deg": [30.0, 31.0, 32.0, 33.0],
            "mean_motion_rev_per_day": [14.2, 14.3, 14.4, 14.5],
        }
    )
    with pytest.raises(ValueError, match="max_pairs"):
        pair_tle_objects(tle_df, strategy="all_pairs", max_pairs=2)
