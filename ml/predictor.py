from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from core.config import settings


class CollisionPredictor:
    def __init__(self, pipeline: Any, model_version: str, metadata: dict[str, Any] | None = None) -> None:
        self._pipeline = pipeline
        self.model_version = model_version
        self.metadata = metadata or {}
        self.probability_threshold = float(
            self.metadata.get("decision_threshold", settings.model_probability_threshold)
        )

    @staticmethod
    def _positive_class_index(estimator: Any) -> int:
        classes = getattr(estimator, "classes_", None)
        if classes is None:
            return 1
        classes_array = list(classes)
        if 1 in classes_array:
            return classes_array.index(1)
        return len(classes_array) - 1

    @classmethod
    def from_artifact(cls, artifact_path: str | Path) -> "CollisionPredictor":
        path = Path(artifact_path)
        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found at {path}")

        artifact = joblib.load(path)
        if isinstance(artifact, dict) and "pipeline" in artifact:
            pipeline = artifact["pipeline"]
            metadata = artifact.get("metadata", {})
            model_version = str(
                metadata.get("trained_at_utc")
                or metadata.get("model_version")
                or datetime.now(timezone.utc).isoformat()
            )
            return cls(pipeline=pipeline, model_version=model_version, metadata=metadata)

        if hasattr(artifact, "predict"):
            return cls(
                pipeline=artifact,
                model_version=datetime.now(timezone.utc).isoformat(),
                metadata={},
            )

        raise ValueError("Artifact format is invalid. Expected sklearn pipeline or metadata dictionary.")

    def predict_probabilities(self, raw_feature_rows: list[dict[str, Any]]) -> list[float]:
        frame = pd.DataFrame(raw_feature_rows)
        if hasattr(self._pipeline, "predict_proba"):
            probabilities = self._pipeline.predict_proba(frame)
            class_index = self._positive_class_index(self._pipeline)
            values = probabilities[:, class_index].astype(float)
            return [float(np.clip(probability, 0.0, 1.0)) for probability in values]

        # Fall back to decision function if probability interface is unavailable.
        score = self._pipeline.decision_function(frame)
        values = 1.0 / (1.0 + np.exp(-score))
        return [float(np.clip(probability, 0.0, 1.0)) for probability in values]

    def predict_probability(self, raw_feature_row: dict[str, Any]) -> float:
        return self.predict_probabilities([raw_feature_row])[0]
