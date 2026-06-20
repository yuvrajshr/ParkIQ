import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { CITIZEN_COOKIE, verifyCitizenToken } from "@/lib/citizen/session";
import { snapToNearestRoad } from "@/lib/citizen/snapRoad";
import { isViolationType } from "@/lib/citizen/violations";
import { moderateNote } from "@/lib/citizen/moderateNote";
import { analyzeReportPhoto } from "@/lib/vision/roboflow";

const BUCKET = "violation-photos";
const MAX_BYTES = 8 * 1024 * 1024;

// Public route (proxy-whitelisted) but self-guarded: a valid citizen-token is required.
// Uploads the photo + inserts the report server-side with the service role.
export async function POST(req: Request) {
  // 1. Require a verified citizen session.
  const cookieStore = await cookies();
  const claims = await verifyCitizenToken(cookieStore.get(CITIZEN_COOKIE)?.value);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "Verify your phone first" }, { status: 401 });
  }

  // 2. Parse the multipart payload.
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const photo = form.get("photo");
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const accuracyRaw = form.get("accuracy");
  const accuracyM = accuracyRaw != null && accuracyRaw !== "" ? Number(accuracyRaw) : null;
  const violationType = String(form.get("type") ?? "");
  const noteRaw = String(form.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw.slice(0, 280) : null;

  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ ok: false, error: "Photo required" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Photo too large" }, { status: 413 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "Location required" }, { status: 400 });
  }
  if (!isViolationType(violationType)) {
    return NextResponse.json({ ok: false, error: "Unknown violation type" }, { status: 400 });
  }

  // 2b. Moderate the optional note BEFORE uploading anything (so a rejected note never leaves
  //     an orphaned photo in Storage). Abusive or off-topic notes reject the whole report.
  const verdict = await moderateNote(note);
  if (!verdict.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "note_rejected",
        reason: verdict.reason,
        error:
          verdict.reason === "profanity"
            ? "Please remove offensive language from your note."
            : "Your note seems unrelated to a parking violation. Please describe the violation or leave it blank.",
      },
      { status: 422 },
    );
  }

  // 2c. AI photo verification (Roboflow workflow), BEFORE upload so a junk photo never leaves an
  //     orphaned object. Read the bytes once and reuse for both the vision call and the upload.
  //     Only "no vehicle at all" blocks the report; a present-but-unflagged vehicle still goes
  //     through (the controller sees an "unverified" chip). Fails open (verdict "skipped").
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const vision = await analyzeReportPhoto(bytes);
  if (vision.verdict === "no_vehicle") {
    return NextResponse.json(
      {
        ok: false,
        code: "no_vehicle",
        error: "We couldn't find a vehicle in this photo. Point the camera at the parked vehicle and retake.",
      },
      { status: 422 },
    );
  }

  // 3. Service-role client (writes bypass RLS).
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Server storage not configured (set SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 },
    );
  }

  // 4. Upload the photo.
  const id = crypto.randomUUID();
  const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const path = `${id}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: photo.type || "image/jpeg", upsert: true });
  if (uploadError) {
    return NextResponse.json({ ok: false, error: `Upload failed: ${uploadError.message}` }, { status: 502 });
  }
  const photoUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  // 5. Snap to the nearest seeded road (human-readable location for the controller).
  const snapped = snapToNearestRoad(lat, lng);

  // 6. Insert the report row.
  const { error: insertError } = await admin.from("citizen_reports").insert({
    id,
    violation_type: violationType,
    note,
    lat,
    lng,
    accuracy_m: accuracyM,
    photo_path: path,
    photo_url: photoUrl,
    snapped_road_id: snapped?.road.id ?? null,
    snapped_road_name: snapped?.road.name ?? null,
    snapped_zone: snapped?.road.zone ?? null,
    snapped_distance_m: snapped?.distanceM ?? null,
    reporter_masked: claims.maskedPhone,
    status: "new",
    ai_verdict: vision.verdict,
    ai_confidence: vision.violationConfidence,
    ai_label: vision.label,
  });
  if (insertError) {
    return NextResponse.json({ ok: false, error: `Save failed: ${insertError.message}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    id,
    snappedRoadName: snapped?.road.name ?? null,
  });
}
