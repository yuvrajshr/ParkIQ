# ParkIQ VIRS Service

FastAPI microservice that serves the **VIRS** (Violation Impact Risk Score) XGBoost model and the
cluster aggregates the ParkIQ dashboard consumes. Local-dev companion to the Next.js app — the Next
server proxies these endpoints (`/api/virs/*`); the browser never calls this service directly.

## Setup

> **Python version:** xgboost 3.2.0 wheels may not yet exist for Python 3.14. If
> `pip install` fails on the xgboost line, create the venv with Python **3.11 or 3.12**.

```powershell
# from parkiq/virs-service
py -3.12 -m venv .venv            # or: python3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python make_fixture.py            # generates data/fixture_scored.csv (synthetic dev data)
```

## Run

```powershell
.\run.ps1                         # macOS/Linux: ./run.sh
# or directly:
python -m uvicorn app.main:app --reload --port 8000
```

Then point the Next app at it: add `VIRS_SERVICE_URL=http://localhost:8000` to `parkiq/.env.local`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + row/cluster counts + `data_source` (`real`/`fixture`) |
| GET | `/model-card` | model metadata + **known caveats** (shown in the UI) |
| GET | `/summary` | city-wide KPIs (rows, clusters, mean VIRS, high-risk count, peak share) |
| GET | `/clusters` | per-cluster aggregates (centroid, avg/max VIRS, count, vehicle mix, peak share) |
| GET | `/clusters/{id}` | one cluster's detail |
| GET | `/heatmap` | cluster-centroid weighted points for the map heat layer |
| GET | `/dispatch-roi` | clusters ranked by interim Dispatch-ROI |
| POST | `/score` | **live inference** — score raw/partial feature rows through the model |
| POST | `/reload` | re-read the scored dataset after dropping in the real CSV |

### `POST /score` example

```bash
curl -X POST localhost:8000/score -H "Content-Type: application/json" \
  -d '{"rows":[{"vt_main_road":1,"is_peak":1,"road_highway_clean":"residential","junction_degree":4}]}'
```

Missing features are median-filled and `est_vehicle_width` / `frc_vulnerability` are derived exactly
as in training (per `model/virs_backend_bundle.json`).

## Wiring the real data (when `virs_final_scored_all.csv` arrives)

1. Drop the file into `data/virs_final_scored_all.csv` (it's gitignored).
2. `POST /reload` (or restart the service). `/health` should now report `data_source: "real"`.
3. No code changes — the dashboard picks up real clusters automatically.

## Notes

- The model's honest limitations (target leakage from `road_vulnerability_score`/`junction_degree`,
  constant `est_vehicle_width`, hardcoded `frc_vulnerability`) are served verbatim at `/model-card`.
- Dispatch-ROI is **interim**: `avg_virs x log1p(count) x (0.5 + 0.5 x peak_share)`. The real
  `P(spike) x 1/travel_time` terms (Prophet + warden routing) multiply in later — see `app/roi.py`.
