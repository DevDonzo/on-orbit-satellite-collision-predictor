from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from core.config import classify_risk, settings
from ml.feature_engineering import FEATURE_COLUMNS, apply_normalization


class OptionalMLPredictor:
    def __init__(self) -> None:
        self.model_path = Path(settings.model_file)
        self.normalizer_path = Path(settings.normalizer_file)
        self.available = False
        self.model = None
        self.stats: dict[str, dict[str, float]] | None = None
        self._load_if_possible()

    def _load_if_possible(self) -> None:
        if not settings.ml_enabled or not self.model_path.exists() or not self.normalizer_path.exists():
            return
        try:
            from tensorflow import keras
        except ImportError:
            return
        with self.normalizer_path.open("r", encoding="utf-8") as f:
            self.stats = json.load(f)
        self.model = keras.models.load_model(self.model_path)
        self.available = True

    def predict_min_distance(self, rows: list[dict[str, float]]) -> list[float]:
        if not self.available or self.model is None or self.stats is None:
            raise RuntimeError("Model is not available.")
        features = pd.DataFrame(rows)[FEATURE_COLUMNS]
        normalized = apply_normalization(features, self.stats)
        predictions = self.model.predict(normalized.to_numpy(dtype=np.float32), verbose=0).reshape(-1)
        return [max(0.0, float(v)) for v in predictions]

    @staticmethod
    def distance_to_risk(distance_km: float) -> str:
        return classify_risk(distance_km)
