"""Paths and runtime config for the VIRS service.

Everything is resolved relative to the service root so the app runs the same whether launched
from `virs-service/` or elsewhere. Override the data/model dirs with env vars if needed.
"""

import os
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent.parent

MODEL_DIR = Path(os.environ.get("VIRS_MODEL_DIR", SERVICE_ROOT / "model"))
DATA_DIR = Path(os.environ.get("VIRS_DATA_DIR", SERVICE_ROOT / "data"))

MODEL_PATH = MODEL_DIR / "virs_model_xgb_semi.json"
BUNDLE_PATH = MODEL_DIR / "virs_backend_bundle.json"

# Real scored dataset (dropped in when ready); fixture is the committed dev stand-in.
REAL_SCORED_PATH = DATA_DIR / "virs_final_scored_all.csv"
FIXTURE_SCORED_PATH = DATA_DIR / "fixture_scored.csv"

# Static cluster_id -> road name lookup (built by make_cluster_names.py from the labels parquet).
CLUSTER_NAMES_PATH = DATA_DIR / "cluster_names.json"

# Cluster surfacing: the real dataset has ~1,848 clusters, most with only a handful of violations
# that score a saturated ~1.0 and would swamp the map with noise. We drop clusters below a minimum
# violation count, then surface the top N by avg_virs (count breaks ties so big hotspots rank above
# tiny ones). Tune these without touching the ranking logic in data.py.
MIN_CLUSTER_VIOLATIONS = int(os.environ.get("VIRS_MIN_CLUSTER_VIOLATIONS", "3"))
TOP_N_CLUSTERS = int(os.environ.get("VIRS_TOP_N_CLUSTERS", "60"))

# The Next.js dev origin allowed through CORS (the browser never calls this service directly
# in production wiring — Next proxies it — but allowing localhost:3000 eases local debugging).
ALLOWED_ORIGINS = os.environ.get(
    "VIRS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
