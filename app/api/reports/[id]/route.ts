import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportStatus } from "@/lib/types";

const STATUSES: ReportStatus[] = ["new", "reviewed", "resolved", "dismissed"];

// Controller-only (lives outside the public /api/citizen prefix, so proxy.ts guards it).
// Updates a report's triage status and/or links a dispatch. Writes via service role.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: { status?: ReportStatus; dispatch_id?: string } = {};
  if (body.status != null) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.dispatchId === "string" && body.dispatchId) {
    patch.dispatch_id = body.dispatchId;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Server storage not configured (set SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 },
    );
  }

  const { error } = await admin.from("citizen_reports").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
