import { NextResponse } from "next/server";
import { listDispatches } from "@/lib/db/store";
import { ROADS } from "@/lib/seed/roads";
import { roadStateAt, parkedAt, type Intervention } from "@/lib/sim/engine";
import { parseT } from "@/lib/api/params";

// Did the dispatch work? Recovered speed, and whether the spot has relapsed.
export function GET(req: Request) {
  const t = parseT(new URL(req.url).searchParams);
  const dispatches = listDispatches();
  const interventions: Intervention[] = dispatches.map((d) => ({
    roadId: d.roadId,
    clearedAtMin: d.etaMin,
  }));

  const outcomes = dispatches.map((d) => {
    const road = ROADS.find((r) => r.id === d.roadId)!;
    const arrived = t >= d.etaMin;
    const speedAfter = Math.round(roadStateAt(road, t, interventions).observedKmph);
    const sinceClear = t - d.etaMin;
    const relapsed = arrived && road.chronic && sinceClear >= 18 && parkedAt(d.roadId, t, interventions) >= 4;
    return {
      ...d,
      arrived,
      speedAfter: arrived ? speedAfter : d.speedBefore,
      recoveredKmph: arrived ? Math.max(0, speedAfter - d.speedBefore) : 0,
      relapsed,
      status: !arrived ? "en_route" : relapsed ? "relapsed" : "cleared",
    };
  });

  return NextResponse.json({ t, outcomes });
}
