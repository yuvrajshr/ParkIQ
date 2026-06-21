"""Load the trained XGBoost VIRS model and score feature rows.

Preprocessing is driven entirely by `virs_backend_bundle.json` so it stays faithful to the
training pipeline (feature order, vehicle-width mapping, FRC lookup, median imputation).
"""

from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb

from . import config


class VirsModel:
    """Thin wrapper around the XGBClassifier + its preprocessing bundle."""

    def __init__(self) -> None:
        with open(config.BUNDLE_PATH, "r", encoding="utf-8") as fh:
            self.bundle: dict[str, Any] = json.load(fh)

        self.feature_order: list[str] = self.bundle["feature_order"]
        pp = self.bundle["preprocessing"]
        self.frc_lookup: dict[str, float] = pp["highway_to_frc_vuln_lookup"]
        self.frc_default: float = pp["frc_vulnerability_default"]
        self.median_fill: dict[str, float] = pp["median_fill_values"]
        self.caveats: list[str] = self.bundle.get("known_caveats", [])
        self.validation_auc: float = self.bundle.get("validation_auc", 0.0)

        self.model = xgb.XGBClassifier()
        self.model.load_model(str(config.MODEL_PATH))

    # -- preprocessing -------------------------------------------------------

    @staticmethod
    def _map_weight(w: Any) -> float:
        """Replicate the notebook's vehicle_weight -> est_vehicle_width rule exactly."""
        if w is None or (isinstance(w, float) and np.isnan(w)):
            return 1.8
        s = str(w).strip().lower()
        if s in ("", "unknown", "null"):
            return 1.8
        if "heavy" in s:
            return 2.5
        if "medium" in s:
            return 2.0
        if "two" in s:
            return 0.8
        return 1.8

    def build_features(self, rows: list[dict[str, Any]]) -> pd.DataFrame:
        """Turn raw/partial input rows into the exact 12-column matrix the model expects."""
        df = pd.DataFrame(rows)

        # Derive est_vehicle_width from raw vehicle_weight when not already supplied.
        if "est_vehicle_width" not in df.columns:
            if "vehicle_weight" in df.columns:
                df["est_vehicle_width"] = df["vehicle_weight"].apply(self._map_weight)
            else:
                df["est_vehicle_width"] = np.nan

        # Derive frc_vulnerability from raw road_highway_clean when not already supplied.
        if "frc_vulnerability" not in df.columns:
            if "road_highway_clean" in df.columns:
                df["frc_vulnerability"] = (
                    df["road_highway_clean"].map(self.frc_lookup).fillna(self.frc_default)
                )
            else:
                df["frc_vulnerability"] = np.nan

        # Ensure every model feature exists, then median-fill from the training-set medians.
        for col in self.feature_order:
            if col not in df.columns:
                df[col] = np.nan
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(self.median_fill[col])

        return df[self.feature_order].astype(float)

    # -- scoring -------------------------------------------------------------

    def score(self, rows: list[dict[str, Any]]) -> list[float]:
        """Return Final_VIRS_Score (P(bottleneck)) for each row."""
        if not rows:
            return []
        X = self.build_features(rows)
        proba = self.model.predict_proba(X.values)[:, 1]
        return [float(p) for p in proba]


_model: VirsModel | None = None


def get_model() -> VirsModel:
    """Lazy singleton — loaded once at startup."""
    global _model
    if _model is None:
        _model = VirsModel()
    return _model
