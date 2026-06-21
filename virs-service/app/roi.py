"""Dispatch-ROI ranking for clusters.

The target formula from VIRS_context.md is:

    Dispatch_ROI = avg_virs x P(spike_next_hour) x (1 / warden_travel_time_min)

We do not yet have Prophet's P(spike) or warden travel times wired in, so this is an **interim**
ranking built only from fields the scored dataset provides. The shape is preserved so the real
spike-probability and travel-time terms can be multiplied in later without changing consumers.
"""

from __future__ import annotations

import math
from typing import Any

from . import data


def ranked() -> list[dict[str, Any]]:
    """Clusters ordered by interim ROI (highest first)."""
    clusters = data.clusters()
    out: list[dict[str, Any]] = []
    for c in clusters:
        # avg_virs        -> severity of a typical violation in the cluster
        # log1p(count)    -> demand proxy (more violations = more vehicles affected), damped
        # peak weighting  -> peak-hour clusters cost more delay
        roi = c["avg_virs"] * math.log1p(c["count"]) * (0.5 + 0.5 * c["peak_share"])
        out.append({**c, "roi": round(roi, 4), "roi_basis": "interim"})
    out.sort(key=lambda c: c["roi"], reverse=True)
    return out
