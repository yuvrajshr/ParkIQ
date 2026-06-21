"""Pydantic request/response models for the VIRS API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    """Live-inference input: a list of feature rows (any subset of the 12 model features,
    or the raw `vehicle_weight` / `road_highway_clean` columns the service derives from)."""

    rows: list[dict[str, Any]] = Field(default_factory=list)


class ScoreResponse(BaseModel):
    scores: list[float]


class HealthResponse(BaseModel):
    ok: bool
    model_loaded: bool
    rows: int
    clusters: int
    data_source: str
    validation_auc: float


class Cluster(BaseModel):
    cluster_id: int
    name: str | None = None
    lat: float
    lng: float
    avg_virs: float
    severity_index: int = 0  # de-saturated VIRS severity, 0-100 (mean log-odds scaled across survivors)
    max_virs: float
    count: int
    peak_share: float
    top_vehicle: str | None
    vehicle_mix: dict[str, float]


class HeatPoint(BaseModel):
    lat: float
    lng: float
    weight: float


class DispatchRoiItem(Cluster):
    roi: float
    roi_basis: str
