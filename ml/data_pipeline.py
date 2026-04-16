from __future__ import annotations

from itertools import combinations
from pathlib import Path
from typing import Any, Iterable, Mapping

import numpy as np
import pandas as pd

ORBITAL_NUMERIC_FIELDS = [
    "eccentricity",
    "inclination_deg",
    "raan_deg",
    "arg_perigee_deg",
    "mean_anomaly_deg",
    "mean_motion_rev_per_day",
]

REQUIRED_RAW_COLUMNS = [
    "a_eccentricity",
    "a_inclination_deg",
    "a_raan_deg",
    "a_arg_perigee_deg",
    "a_mean_anomaly_deg",
    "a_mean_motion_rev_per_day",
    "b_eccentricity",
    "b_inclination_deg",
    "b_raan_deg",
    "b_arg_perigee_deg",
    "b_mean_anomaly_deg",
    "b_mean_motion_rev_per_day",
]

OPTIONAL_RAW_COLUMNS = ["closest_approach_km", "relative_velocity_kms"]


def _parse_tle_exponent_field(raw: str) -> float | None:
    cleaned = raw.strip()
    if not cleaned:
        return None
    sign = -1.0 if cleaned[0] == "-" else 1.0
    if cleaned[0] in "+-":
        cleaned = cleaned[1:]
    if len(cleaned) < 3:
        return None
    mantissa = float(f"0.{cleaned[:-2]}")
    exponent = int(cleaned[-2:])
    return sign * mantissa * (10**exponent)


def parse_tle_text(tle_text: str) -> pd.DataFrame:
    """
    Parse TLE line sets into numeric orbital parameters.

    Supported patterns:
    1. Two-line records (line1 + line2).
    2. Three-line records (name + line1 + line2).
    """

    lines = [line.rstrip() for line in tle_text.splitlines() if line.strip()]
    records: list[dict[str, Any]] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        if line.startswith("1 "):
            if i + 1 >= len(lines) or not lines[i + 1].startswith("2 "):
                raise ValueError(f"Malformed TLE near line index {i}.")
            line1 = lines[i]
            line2 = lines[i + 1]
            records.append(_parse_tle_record(line1=line1, line2=line2, object_name=None))
            i += 2
            continue

        if i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
            records.append(
                _parse_tle_record(
                    line1=lines[i + 1],
                    line2=lines[i + 2],
                    object_name=lines[i].strip(),
                )
            )
            i += 3
            continue

        i += 1

    if not records:
        raise ValueError("No valid TLE records found in payload.")
    return pd.DataFrame.from_records(records)


def _verify_tle_checksum(line: str) -> None:
    """
    Validate NORAD TLE checksum when a checksum digit is present.

    The checksum is the modulo-10 sum of all digits in columns 1-68, where '-'
    contributes +1 and all other non-digit characters contribute +0.
    """

    if len(line) < 69 or not line[68].isdigit():
        return
    checksum = 0
    for char in line[:68]:
        if char.isdigit():
            checksum += int(char)
        elif char == "-":
            checksum += 1
    if checksum % 10 != int(line[68]):
        raise ValueError(f"TLE checksum validation failed for line: {line}")


def _parse_tle_record(line1: str, line2: str, object_name: str | None) -> dict[str, Any]:
    if len(line1) < 61 or len(line2) < 63:
        raise ValueError("TLE lines are too short to parse.")
    if not line1.startswith("1 ") or not line2.startswith("2 "):
        raise ValueError("TLE record must include line 1 and line 2 in order.")
    _verify_tle_checksum(line1)
    _verify_tle_checksum(line2)

    sat_id_line1 = line1[2:7].strip()
    sat_id_line2 = line2[2:7].strip()
    if sat_id_line1 and sat_id_line2 and sat_id_line1 != sat_id_line2:
        raise ValueError(f"TLE record satellite IDs do not match: {sat_id_line1} vs {sat_id_line2}.")

    sat_id = sat_id_line1 or sat_id_line2
    eccentricity_raw = line2[26:33].strip()
    eccentricity = float(f"0.{eccentricity_raw}")
    bstar = _parse_tle_exponent_field(line1[53:61])

    return {
        "object_id": object_name or sat_id or "unknown",
        "eccentricity": eccentricity,
        "inclination_deg": float(line2[8:16]),
        "raan_deg": float(line2[17:25]),
        "arg_perigee_deg": float(line2[34:42]),
        "mean_anomaly_deg": float(line2[43:51]),
        "mean_motion_rev_per_day": float(line2[52:63]),
        "bstar": bstar,
    }


def cdm_records_to_pair_dataframe(records: Iterable[Mapping[str, Any]]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for item in records:
        object_a = item["object_a"]
        object_b = item["object_b"]
        row: dict[str, Any] = {}
        for field in ORBITAL_NUMERIC_FIELDS:
            row[f"a_{field}"] = object_a[field]
            row[f"b_{field}"] = object_b[field]
        row["closest_approach_km"] = item.get("closest_approach_km")
        row["relative_velocity_kms"] = item.get("relative_velocity_kms")
        if "collision_event" in item and item["collision_event"] is not None:
            row["collision_event"] = int(item["collision_event"])
        rows.append(row)
    return pd.DataFrame.from_records(rows)


def pair_adjacent_tle_objects(tle_df: pd.DataFrame) -> pd.DataFrame:
    return pair_tle_objects(tle_df=tle_df, strategy="adjacent")


def pair_tle_objects(
    tle_df: pd.DataFrame,
    strategy: str = "adjacent",
    max_pairs: int = 50000,
) -> pd.DataFrame:
    """
    Build pairwise conjunction candidates from parsed TLE objects.

    Strategies:
    - adjacent: consecutive records only (N-1 pairs).
    - all_pairs: all unique combinations (N * (N-1) / 2), bounded by max_pairs.
    """

    if len(tle_df) < 2:
        raise ValueError("At least two objects are required to build pairwise records.")

    if strategy == "adjacent":
        left = tle_df.iloc[:-1].reset_index(drop=True)
        right = tle_df.iloc[1:].reset_index(drop=True)
        out = pd.DataFrame(
            {
                "a_object_id": left["object_id"],
                "b_object_id": right["object_id"],
            }
        )
        for field in ORBITAL_NUMERIC_FIELDS:
            out[f"a_{field}"] = left[field].to_numpy()
            out[f"b_{field}"] = right[field].to_numpy()
        out["closest_approach_km"] = np.nan
        out["relative_velocity_kms"] = np.nan
        return out

    if strategy == "all_pairs":
        total_possible = (len(tle_df) * (len(tle_df) - 1)) // 2
        if total_possible > max_pairs:
            raise ValueError(
                f"all_pairs strategy would generate {total_possible} pairs; "
                f"max_pairs is {max_pairs}. Reduce input size or use adjacent strategy."
            )
        rows: list[dict[str, Any]] = []
        for i, j in combinations(range(len(tle_df)), 2):
            left = tle_df.iloc[i]
            right = tle_df.iloc[j]
            row: dict[str, Any] = {
                "a_object_id": left["object_id"],
                "b_object_id": right["object_id"],
            }
            for field in ORBITAL_NUMERIC_FIELDS:
                row[f"a_{field}"] = left[field]
                row[f"b_{field}"] = right[field]
            row["closest_approach_km"] = np.nan
            row["relative_velocity_kms"] = np.nan
            rows.append(row)
        return pd.DataFrame.from_records(rows)

    raise ValueError(f"Unsupported TLE pairing strategy: {strategy}")


def load_orbital_dataset(path: str | Path) -> pd.DataFrame:
    file_path = Path(path)
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(file_path)
    if suffix == ".json":
        return pd.read_json(file_path)
    if suffix == ".jsonl":
        return pd.read_json(file_path, lines=True)
    if suffix in {".tle", ".txt"}:
        return parse_tle_text(file_path.read_text(encoding="utf-8"))
    raise ValueError(f"Unsupported dataset extension: {suffix}")


def standardize_pair_dataset(df: pd.DataFrame, label_required: bool) -> pd.DataFrame:
    """
    Normalize CDM-like datasets into canonical training/inference columns.

    Accepted source columns may include compact aliases such as `obj1_raan` and
    canonical API columns such as `a_raan_deg`.
    """

    working = df.copy()
    if {"object_a", "object_b"}.issubset(working.columns):
        expanded_a = pd.json_normalize(working["object_a"]).add_prefix("object_a.")
        expanded_b = pd.json_normalize(working["object_b"]).add_prefix("object_b.")
        working = pd.concat([working.drop(columns=["object_a", "object_b"]), expanded_a, expanded_b], axis=1)

    alias_map: dict[str, list[str]] = {
        "a_eccentricity": ["a_eccentricity", "obj1_eccentricity", "object_a.eccentricity"],
        "a_inclination_deg": ["a_inclination_deg", "obj1_inclination_deg", "object_a.inclination_deg"],
        "a_raan_deg": ["a_raan_deg", "obj1_raan_deg", "object_a.raan_deg"],
        "a_arg_perigee_deg": ["a_arg_perigee_deg", "obj1_arg_perigee_deg", "object_a.arg_perigee_deg"],
        "a_mean_anomaly_deg": ["a_mean_anomaly_deg", "obj1_mean_anomaly_deg", "object_a.mean_anomaly_deg"],
        "a_mean_motion_rev_per_day": [
            "a_mean_motion_rev_per_day",
            "obj1_mean_motion_rev_per_day",
            "object_a.mean_motion_rev_per_day",
        ],
        "b_eccentricity": ["b_eccentricity", "obj2_eccentricity", "object_b.eccentricity"],
        "b_inclination_deg": ["b_inclination_deg", "obj2_inclination_deg", "object_b.inclination_deg"],
        "b_raan_deg": ["b_raan_deg", "obj2_raan_deg", "object_b.raan_deg"],
        "b_arg_perigee_deg": ["b_arg_perigee_deg", "obj2_arg_perigee_deg", "object_b.arg_perigee_deg"],
        "b_mean_anomaly_deg": ["b_mean_anomaly_deg", "obj2_mean_anomaly_deg", "object_b.mean_anomaly_deg"],
        "b_mean_motion_rev_per_day": [
            "b_mean_motion_rev_per_day",
            "obj2_mean_motion_rev_per_day",
            "object_b.mean_motion_rev_per_day",
        ],
        "closest_approach_km": ["closest_approach_km", "miss_distance_km"],
        "relative_velocity_kms": ["relative_velocity_kms", "relative_speed_kms"],
    }
    label_aliases = ["collision_event", "collision", "label", "is_collision"]

    normalized = pd.DataFrame(index=df.index)
    for target in REQUIRED_RAW_COLUMNS + OPTIONAL_RAW_COLUMNS:
        source_col = next((col for col in alias_map[target] if col in working.columns), None)
        if source_col is None:
            if target in REQUIRED_RAW_COLUMNS:
                raise ValueError(f"Missing required feature column: {target}")
            normalized[target] = np.nan
        else:
            normalized[target] = pd.to_numeric(working[source_col], errors="coerce")

    label_col = next((col for col in label_aliases if col in working.columns), None)
    if label_required and label_col is None:
        raise ValueError("No label column found. Expected one of: collision_event, collision, label.")
    if label_col:
        normalized["collision_event"] = pd.to_numeric(working[label_col], errors="raise").astype(int)

    if (normalized["a_mean_motion_rev_per_day"] <= 0).any() or (
        normalized["b_mean_motion_rev_per_day"] <= 0
    ).any():
        raise ValueError("Mean motion values must be strictly positive.")

    return normalized
