"""VIRS scoring microservice (FastAPI).

Local-dev companion to the ParkIQ Next.js app. The Next server proxies these endpoints; the
browser never calls this service directly. Start with:

    python -m uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import config, data, roi
from .model import get_model
from .schemas import (
    Cluster,
    DispatchRoiItem,
    HealthResponse,
    HeatPoint,
    ScoreRequest,
    ScoreResponse,
)

app = FastAPI(title="ParkIQ VIRS Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warm() -> None:
    # Load the model and dataset once at boot so the first request is fast and failures surface early.
    get_model()
    data.summary()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    model = get_model()
    s = data.summary()
    return HealthResponse(
        ok=True,
        model_loaded=model.model is not None,
        rows=s["rows"],
        clusters=s["clusters"],
        data_source=s["data_source"],
        validation_auc=model.validation_auc,
    )


@app.get("/model-card")
def model_card() -> dict:
    """Honest model metadata — surfaced in the UI so users see the known limitations."""
    model = get_model()
    return {
        "model_type": model.bundle.get("model_type"),
        "xgboost_version": model.bundle.get("xgboost_version"),
        "validation_auc": model.validation_auc,
        "feature_order": model.feature_order,
        "target_definition": model.bundle.get("target_definition"),
        "output_score": model.bundle.get("output_score"),
        "known_caveats": model.caveats,
    }


@app.get("/summary")
def summary() -> dict:
    return data.summary()


@app.get("/clusters", response_model=list[Cluster])
def clusters() -> list[dict]:
    return data.clusters()


@app.get("/clusters/{cluster_id}", response_model=Cluster)
def cluster_detail(cluster_id: int) -> dict:
    c = data.cluster_by_id(cluster_id)
    if c is None:
        raise HTTPException(status_code=404, detail=f"cluster {cluster_id} not found")
    return c


@app.get("/heatmap", response_model=list[HeatPoint])
def heatmap() -> list[dict]:
    # Cluster-centroid weighted points — keeps the payload small (never ships raw 285k points).
    return [{"lat": c["lat"], "lng": c["lng"], "weight": c["avg_virs"]} for c in data.clusters()]


@app.get("/dispatch-roi", response_model=list[DispatchRoiItem])
def dispatch_roi() -> list[dict]:
    return roi.ranked()


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    return ScoreResponse(scores=get_model().score(req.rows))


@app.post("/reload")
def reload_data() -> dict:
    """Re-read the scored dataset (call after dropping in the real CSV)."""
    data.reload()
    return data.summary()
