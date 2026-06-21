"""Generate a synthetic scored dataset so the dashboard renders end-to-end before the real
`virs_final_scored_all.csv` arrives. Columns match the real output schema exactly, so swapping
in the real file later needs zero code changes.

    python make_fixture.py
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app import config

RNG = np.random.default_rng(42)

# A handful of plausible Bengaluru hotspot centroids inside the app's map bounds
# (lat 12.7-13.2, lng 77.4-77.9). Each becomes one ST-DBSCAN-style cluster.
CLUSTER_CENTROIDS = [
    ("Silk Board Junction", 12.9172, 77.6230, 0.86),
    ("KR Market", 12.9610, 77.5760, 0.81),
    ("Marathahalli Bridge", 12.9560, 77.7010, 0.78),
    ("Whitefield Main Rd", 12.9698, 77.7500, 0.55),
    ("Indiranagar 100ft Rd", 12.9719, 77.6412, 0.62),
    ("Koramangala 80ft Rd", 12.9352, 77.6245, 0.58),
    ("Hebbal Flyover", 13.0358, 77.5970, 0.72),
    ("Majestic Bus Stand", 12.9767, 77.5713, 0.83),
    ("Jayanagar 4th Block", 12.9250, 77.5938, 0.41),
    ("Electronic City Phase 1", 12.8452, 77.6602, 0.49),
    ("MG Road", 12.9756, 77.6068, 0.66),
    ("Banashankari", 12.9250, 77.5468, 0.38),
    ("Yeshwanthpur", 13.0280, 77.5400, 0.59),
    ("BTM Layout", 12.9166, 77.6101, 0.53),
    ("Sarjapur Rd", 12.9010, 77.6870, 0.69),
]

VEHICLE_TYPES = ["CAR", "BIKE", "AUTO", "TRUCK", "BUS"]
VEHICLE_P = [0.46, 0.30, 0.14, 0.06, 0.04]


def build() -> pd.DataFrame:
    rows = []
    vid = 0
    for cid, (_name, lat, lng, base_virs) in enumerate(CLUSTER_CENTROIDS):
        n = int(RNG.integers(60, 320))  # violations in this cluster
        for _ in range(n):
            jitter_lat = lat + RNG.normal(0, 0.004)
            jitter_lng = lng + RNG.normal(0, 0.004)
            score = float(np.clip(RNG.normal(base_virs, 0.12), 0.01, 0.99))
            rows.append(
                {
                    "id": f"V{vid:06d}",
                    "cluster_id": cid,
                    "latitude": round(jitter_lat, 6),
                    "longitude": round(jitter_lng, 6),
                    "vehicle_type": RNG.choice(VEHICLE_TYPES, p=VEHICLE_P),
                    "is_peak": int(RNG.random() < (0.4 + 0.4 * base_virs)),
                    "Final_VIRS_Score": round(score, 4),
                }
            )
            vid += 1
    return pd.DataFrame(rows)


if __name__ == "__main__":
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    df = build()
    df.to_csv(config.FIXTURE_SCORED_PATH, index=False)
    print(f"Wrote {len(df):,} synthetic violations across {df['cluster_id'].nunique()} clusters")
    print(f"  -> {config.FIXTURE_SCORED_PATH}")
    print(f"  mean Final_VIRS_Score = {df['Final_VIRS_Score'].mean():.3f}")
