"""Precompute a cluster_id -> road name lookup for the VIRS dashboard.

The scored CSV (data/virs_final_scored_all.csv) carries only integer cluster_ids. The Stage-3
labels parquet, however, carries a `road_name` per violation (~83% populated). We take the most
common non-null road_name per cluster as that cluster's display name and ship the result as
data/cluster_names.json — a small static sidecar the service loads at startup. This is more
accurate than reverse-geocoding a cluster centroid (which often snaps to the wrong nearby street)
and needs no external geocoding service.

Re-run this if the scored dataset or the labels parquet changes:
    ./.venv/Scripts/python.exe make_cluster_names.py /path/to/stage3_impact_labels.parquet
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

SERVICE_ROOT = Path(__file__).resolve().parent
CSV_PATH = SERVICE_ROOT / "data" / "virs_final_scored_all.csv"
OUT_PATH = SERVICE_ROOT / "data" / "cluster_names.json"

# Default labels-parquet location (the file the user dropped into the project root).
DEFAULT_LABELS = SERVICE_ROOT.parent.parent / "stage3_impact_labels.parquet"


def main() -> None:
    labels_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_LABELS
    if not CSV_PATH.exists():
        raise SystemExit(f"scored CSV not found: {CSV_PATH}")
    if not labels_path.exists():
        raise SystemExit(f"labels parquet not found: {labels_path}")

    csv = pd.read_csv(CSV_PATH, usecols=["id", "cluster_id"])
    labels = pd.read_parquet(labels_path, columns=["id", "road_name"])
    merged = csv.merge(labels, on="id", how="left")

    names: dict[str, str] = {}
    for cid, g in merged.groupby("cluster_id"):
        s = g["road_name"].dropna()
        if len(s):
            names[str(int(cid))] = str(s.value_counts().index[0])

    OUT_PATH.write_text(json.dumps(names, ensure_ascii=False, indent=0), encoding="utf-8")
    total = merged["cluster_id"].nunique()
    print(f"wrote {OUT_PATH}  ({len(names)}/{total} clusters named)")


if __name__ == "__main__":
    main()
