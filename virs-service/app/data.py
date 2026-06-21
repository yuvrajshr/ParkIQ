"""Load the scored violation dataset and derive cluster-level aggregates.

The heatmap, dispatch-ROI ranking, and cluster detail are all aggregations of the per-violation
`Final_VIRS_Score` grouped by `cluster_id` — so this module is the single source of truth for
those surfaces. It auto-selects the real scored CSV when present, else the synthetic fixture.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd

from . import config

# Columns we rely on from the scored dataset (per VIRS_context.md output schema).
REQUIRED_COLS = ["cluster_id", "latitude", "longitude", "vehicle_type", "is_peak", "Final_VIRS_Score"]

HIGH_RISK_THRESHOLD = 0.70


def _resolve_path() -> tuple[str, str]:
    """Return (path, source) — prefer the real scored dataset, fall back to the fixture."""
    if config.REAL_SCORED_PATH.exists():
        return str(config.REAL_SCORED_PATH), "real"
    return str(config.FIXTURE_SCORED_PATH), "fixture"


@lru_cache(maxsize=1)
def _names() -> dict[str, str]:
    """cluster_id (as str) -> road name; empty dict if the lookup hasn't been generated."""
    if config.CLUSTER_NAMES_PATH.exists():
        return json.loads(config.CLUSTER_NAMES_PATH.read_text(encoding="utf-8"))
    return {}


@lru_cache(maxsize=1)
def _load() -> tuple[pd.DataFrame, str]:
    path, source = _resolve_path()
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Scored dataset {path} missing columns: {missing}")
    # ST-DBSCAN labels unclustered noise as -1 — drop it from cluster surfaces.
    df = df[df["cluster_id"] != -1].copy()
    return df, source


def reload() -> None:
    """Clear the caches so a freshly dropped-in CSV / names file is picked up on next request."""
    _load.cache_clear()
    _names.cache_clear()
    _survivors.cache_clear()


@lru_cache(maxsize=1)
def _survivors() -> list[dict[str, Any]]:
    """Every cluster with enough violations to be meaningful, ranked by severity.

    Clusters below MIN_CLUSTER_VIOLATIONS are dropped (they score a saturated ~1.0 on 1-3
    violations and would otherwise dominate the rankings). Survivors are ordered by avg_virs, with
    violation count as the tie-breaker so a 175-violation hotspot outranks a 10-violation one when
    both saturate at 1.0.
    """
    df, _ = _load()
    names = _names()
    out: list[dict[str, Any]] = []
    for cid, g in df.groupby("cluster_id"):
        if len(g) < config.MIN_CLUSTER_VIOLATIONS:
            continue
        counts = g["vehicle_type"].value_counts()
        total = int(counts.sum())
        vehicle_mix = {str(k): round(int(v) / total, 4) for k, v in counts.items()} if total else {}
        # Mean log-odds — the model's severity *before* the sigmoid squashes it to ~1.0. Unlike the
        # probability, this stays spread out among the extreme top clusters, so it can rank them.
        p = g["Final_VIRS_Score"].clip(1e-6, 1 - 1e-6)
        mean_logit = float(np.log(p / (1 - p)).mean())
        out.append(
            {
                "cluster_id": int(cid),
                "name": names.get(str(int(cid))),
                "lat": float(g["latitude"].mean()),
                "lng": float(g["longitude"].mean()),
                "avg_virs": round(float(g["Final_VIRS_Score"].mean()), 4),
                "max_virs": round(float(g["Final_VIRS_Score"].max()), 4),
                "count": int(len(g)),
                "peak_share": round(float(g["is_peak"].mean()), 4),
                "top_vehicle": str(counts.index[0]) if len(counts) else None,
                "vehicle_mix": vehicle_mix,
                "_mean_logit": mean_logit,
            }
        )
    # De-saturated severity index: min-max the mean log-odds across all survivors onto 0-100, so the
    # headline number varies (100, 95, 92, ...) instead of pinning every top hotspot to 100.
    if out:
        logits = [c["_mean_logit"] for c in out]
        lo, hi = min(logits), max(logits)
        for c in out:
            c["severity_index"] = (
                round((c["_mean_logit"] - lo) / (hi - lo) * 100) if hi > lo else round(c["avg_virs"] * 100)
            )
            del c["_mean_logit"]
    out.sort(key=lambda c: (c["avg_virs"], c["count"]), reverse=True)
    return out


def _bengaluru_zone(lat: float, lng: float) -> str:
    if lat > 13.0:   return "North"
    if lat < 12.93:  return "South"
    if lng > 77.65:  return "East"
    if lng < 77.55:  return "West"
    return "CBD"


def clusters() -> list[dict[str, Any]]:
    """Per-zone stratified selection so every Bengaluru area shows a full
    Critical / High / Medium / Low spread in the dispatch queue.

    For TOP_N_CLUSTERS=60 across 5 zones: 3 clusters per severity tier per zone
    (3 × 4 tiers × 5 zones = 60). Within each tier, the highest-impact cluster
    is taken first (already sorted by avg_virs × count in _survivors).
    Falls back gracefully when a zone has fewer clusters in a tier.
    """
    survivors = _survivors()
    n = config.TOP_N_CLUSTERS
    zone_keys = ["CBD", "North", "South", "East", "West"]

    # Group all survivors by zone
    by_zone: dict[str, list] = {z: [] for z in zone_keys}
    for c in survivors:
        by_zone[_bengaluru_zone(c["lat"], c["lng"])].append(c)

    # How many clusters to pick per tier per zone
    n_zones    = len(zone_keys)
    n_tiers    = 4
    per_slot   = max(1, n // (n_zones * n_tiers))   # 3 for n=60

    result: list[dict[str, Any]] = []
    for zone in zone_keys:
        zc = by_zone[zone]
        for lo, hi in [(75, 101), (50, 75), (25, 50), (0, 25)]:
            tier = [c for c in zc if lo <= c["severity_index"] < hi]
            result.extend(tier[:per_slot])

    return result[:n]


def cluster_by_id(cluster_id: int) -> dict[str, Any] | None:
    return next((c for c in _survivors() if c["cluster_id"] == cluster_id), None)


def summary() -> dict[str, Any]:
    df, source = _load()
    survivors = _survivors()
    high_risk = sum(1 for c in survivors if c["avg_virs"] >= HIGH_RISK_THRESHOLD)
    return {
        "rows": int(len(df)),
        "clusters": len(survivors),
        "surfaced": len(clusters()),
        "mean_virs": round(float(df["Final_VIRS_Score"].mean()), 4) if len(df) else 0.0,
        "high_risk_clusters": high_risk,
        "peak_share": round(float(df["is_peak"].mean()), 4) if len(df) else 0.0,
        "data_source": source,
    }
