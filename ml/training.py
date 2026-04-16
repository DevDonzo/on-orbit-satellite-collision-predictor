from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline

from core.config import settings
from ml.data_pipeline import OPTIONAL_RAW_COLUMNS, REQUIRED_RAW_COLUMNS, load_orbital_dataset, standardize_pair_dataset
from ml.feature_engineering import PairFeatureEngineer


def build_training_pipeline(model_type: str, random_state: int) -> Pipeline:
    if model_type == "gradient_boosting":
        model = GradientBoostingClassifier(random_state=random_state)
    elif model_type == "random_forest":
        model = RandomForestClassifier(
            n_estimators=400,
            max_depth=18,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=random_state,
            n_jobs=-1,
        )
    else:
        raise ValueError("Unsupported model_type. Use 'random_forest' or 'gradient_boosting'.")

    return Pipeline(
        steps=[
            ("pair_features", PairFeatureEngineer()),
            ("imputer", SimpleImputer(strategy="median")),
            ("model", model),
        ]
    )


def _build_search_grid(model_type: str) -> dict[str, list[Any]]:
    if model_type == "random_forest":
        return {
            "model__n_estimators": [250, 400, 650],
            "model__max_depth": [12, 18, None],
            "model__min_samples_leaf": [1, 2, 4],
        }
    return {
        "model__n_estimators": [100, 200, 350],
        "model__learning_rate": [0.03, 0.06, 0.1],
        "model__max_depth": [2, 3, 4],
        "model__subsample": [0.8, 1.0],
    }


def _optimize_threshold(y_true: np.ndarray, y_score: np.ndarray) -> float:
    precision, recall, thresholds = precision_recall_curve(y_true, y_score)
    if len(thresholds) == 0:
        return 0.5
    numer = 2.0 * precision[:-1] * recall[:-1]
    denom = precision[:-1] + recall[:-1] + 1e-12
    f1_scores = numer / denom
    best_idx = int(np.argmax(f1_scores))
    return float(np.clip(thresholds[best_idx], 0.01, 0.99))


def _calibration_cv_folds(y: np.ndarray, max_folds: int = 3) -> int:
    _, counts = np.unique(y, return_counts=True)
    if len(counts) < 2:
        return 0
    return max(0, min(max_folds, int(np.min(counts))))


def train_evaluate_serialize(
    dataset_path: str | Path,
    model_output_path: str | Path,
    model_type: str,
    random_state: int = 42,
    test_size: float = 0.2,
    validation_size: float = 0.2,
    enable_model_selection: bool = True,
    enable_probability_calibration: bool = True,
) -> dict[str, Any]:
    raw = load_orbital_dataset(dataset_path)
    dataset = standardize_pair_dataset(raw, label_required=True)

    X = dataset[REQUIRED_RAW_COLUMNS + OPTIONAL_RAW_COLUMNS]
    y = dataset["collision_event"].astype(int).to_numpy()
    if np.unique(y).size < 2:
        raise ValueError("Training labels must include both collision and non-collision classes.")

    stratify = y if np.unique(y).size > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify
    )
    train_stratify = y_train if np.unique(y_train).size > 1 else None
    X_train_inner, X_val, y_train_inner, y_val = train_test_split(
        X_train,
        y_train,
        test_size=validation_size,
        random_state=random_state,
        stratify=train_stratify,
    )

    pipeline = build_training_pipeline(model_type=model_type, random_state=random_state)
    best_params: dict[str, Any] = {}
    if enable_model_selection:
        search = GridSearchCV(
            estimator=pipeline,
            param_grid=_build_search_grid(model_type=model_type),
            scoring="f1",
            cv=3,
            n_jobs=-1,
            refit=True,
        )
        search.fit(X_train_inner, y_train_inner)
        pipeline = search.best_estimator_
        best_params = dict(search.best_params_)
    else:
        pipeline.fit(X_train_inner, y_train_inner)

    estimator: Any = pipeline
    calibrated = False
    if enable_probability_calibration:
        folds = _calibration_cv_folds(y_train_inner, max_folds=3)
        if folds >= 2:
            calibrator = CalibratedClassifierCV(estimator=pipeline, method="sigmoid", cv=folds)
            calibrator.fit(X_train_inner, y_train_inner)
            estimator = calibrator
            calibrated = True

    if hasattr(estimator, "predict_proba"):
        y_val_score = estimator.predict_proba(X_val)[:, 1]
        decision_threshold = _optimize_threshold(y_val, y_val_score)
        y_score = estimator.predict_proba(X_test)[:, 1]
        y_pred = (y_score >= decision_threshold).astype(int)
    else:
        decision_threshold = 0.5
        y_pred = estimator.predict(X_test)
        y_score = y_pred.astype(float)

    metrics: dict[str, Any] = {
        "decision_threshold": float(decision_threshold),
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "average_precision": float(average_precision_score(y_test, y_score)),
    }
    if np.unique(y_test).size > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_test, y_score))
        metrics["brier_score"] = float(brier_score_loss(y_test, y_score))
        metrics["log_loss"] = float(log_loss(y_test, np.vstack([1.0 - y_score, y_score]).T))
    else:
        metrics["roc_auc"] = None
        metrics["brier_score"] = None
        metrics["log_loss"] = None

    model_output = Path(model_output_path)
    model_output.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "pipeline": estimator,
        "metadata": {
            "model_type": model_type,
            "trained_at_utc": datetime.now(timezone.utc).isoformat(),
            "dataset_path": str(dataset_path),
            "train_size": int(len(X_train_inner)),
            "validation_size": int(len(X_val)),
            "test_size": int(len(X_test)),
            "positive_rate_train": float(np.mean(y_train_inner)),
            "positive_rate_validation": float(np.mean(y_val)),
            "positive_rate_test": float(np.mean(y_test)),
            "decision_threshold": float(decision_threshold),
            "calibrated": calibrated,
            "best_params": best_params,
            "metrics": metrics,
        },
    }
    joblib.dump(artifact, model_output)
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and serialize satellite collision predictor.")
    parser.add_argument("--dataset", required=True, help="Path to training dataset (.csv/.json/.jsonl).")
    parser.add_argument(
        "--output",
        default="models/collision_model.joblib",
        help="Serialized model path.",
    )
    parser.add_argument(
        "--model-type",
        choices=["random_forest", "gradient_boosting"],
        default="random_forest",
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--validation-size", type=float, default=0.2)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument(
        "--disable-model-selection",
        action="store_true",
        help="Skip hyperparameter search and use base estimator defaults.",
    )
    parser.add_argument(
        "--disable-calibration",
        action="store_true",
        help="Skip probability calibration.",
    )
    args = parser.parse_args()

    metrics = train_evaluate_serialize(
        dataset_path=args.dataset,
        model_output_path=args.output,
        model_type=args.model_type,
        test_size=args.test_size,
        validation_size=args.validation_size,
        random_state=args.random_state,
        enable_model_selection=not args.disable_model_selection and settings.enable_model_selection,
        enable_probability_calibration=(
            not args.disable_calibration and settings.enable_probability_calibration
        ),
    )
    print(json.dumps(metrics, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
