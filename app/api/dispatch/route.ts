import { NextResponse } from "next/server";
import { createDispatch } from "@/lib/db/store";

// Commander action: assign the nearest available warden to a hotspot.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const roadId = String(body.roadId ?? "");
  const simMin = Number(body.simMin ?? 0);

  if (!roadId) {
    return NextResponse.json({ ok: false, error: "roadId required" }, { status: 400 });
  }

  const result = createDispatch(roadId, simMin);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
