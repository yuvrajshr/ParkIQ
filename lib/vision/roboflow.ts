/**
 * Roboflow hosted-Workflow client for citizen photo verification.
 *
 * One HTTP call runs two models server-side (see the `parkiq-citizen-report-check` workflow):
 *   - `vehicles`  — COCO yolov8n-640, generic vehicle presence (the no-vehicle gate)
 *   - `violation` — illegal-parking-detection-pwrjk/1, the single-class violation flag
 *
 * The single-class violation model can only assert a POSITIVE flag — absence of a detection is
 * not proof there's no vehicle — so vehicle presence comes from the COCO step instead. We filter
 * COCO output to real vehicle classes app-side (the workflow's class_filter is unreliable at the
 * cached hosted endpoint), then derive one verdict.
 *
 * Fail-open by design: missing key, timeout, or any error → `verdict: "skipped"`, so a moderation
 * outage never blocks an otherwise-valid report (same contract as lib/citizen/moderateNote).
 */

export type VisionVerdict = "violation" | "no_violation" | "no_vehicle" | "skipped";

export interface VisionResult {
  verdict: VisionVerdict;
  /** Number of vehicles the generic detector found (after class + confidence filtering). */
  vehicleCount: number;
  /** Highest violation-box confidence in 0..1 (0 when none). */
  violationConfidence: number;
  /** Top class label for display (violation class, else top vehicle class, else null). */
  label: string | null;
}

interface RoboflowPrediction {
  class?: string;
  confidence?: number;
}

const VEHICLE_CLASSES = new Set(
  (process.env.ROBOFLOW_VEHICLE_CLASSES ?? "car,truck,bus,motorcycle,motorbike,bicycle")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean),
);
const VEHICLE_CONF = Number(process.env.ROBOFLOW_VEHICLE_CONF ?? "0.4");
const VIOLATION_CONF = Number(process.env.ROBOFLOW_VIOLATION_CONF ?? "0.3");
const TIMEOUT_MS = Number(process.env.ROBOFLOW_TIMEOUT_MS ?? "12000");
const HOST = process.env.ROBOFLOW_HOST ?? "https://serverless.roboflow.com";

const SKIPPED: VisionResult = { verdict: "skipped", vehicleCount: 0, violationConfidence: 0, label: null };

function toBase64(image: Uint8Array | Buffer | string): string {
  if (typeof image === "string") return image;
  return Buffer.from(image).toString("base64");
}

/** Run the citizen-photo workflow and derive a single verdict. Never throws — fails open. */
export async function analyzeReportPhoto(image: Uint8Array | Buffer | string): Promise<VisionResult> {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const workspace = process.env.ROBOFLOW_WORKSPACE;
  const workflow = process.env.ROBOFLOW_WORKFLOW;
  if (!apiKey || !workspace || !workflow) return SKIPPED;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HOST}/infer/workflows/${workspace}/${workflow}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, inputs: { image: { type: "base64", value: toBase64(image) } } }),
      signal: controller.signal,
    });
    if (!res.ok) return SKIPPED;
    const data = await res.json();
    const out = data?.outputs?.[0] ?? {};

    const vehiclePreds: RoboflowPrediction[] = (out.vehicle_predictions?.predictions ?? []).filter(
      (p: RoboflowPrediction) =>
        VEHICLE_CLASSES.has((p.class ?? "").toLowerCase()) && (p.confidence ?? 0) >= VEHICLE_CONF,
    );
    const violationPreds: RoboflowPrediction[] = (out.violation_predictions?.predictions ?? []).filter(
      (p: RoboflowPrediction) => (p.confidence ?? 0) >= VIOLATION_CONF,
    );

    const vehicleCount = vehiclePreds.length;
    const violationConfidence = violationPreds.reduce((m, p) => Math.max(m, p.confidence ?? 0), 0);

    if (violationPreds.length > 0) {
      return { verdict: "violation", vehicleCount, violationConfidence, label: "Illegal Parking" };
    }
    if (vehicleCount > 0) {
      const topVehicle = vehiclePreds.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      return { verdict: "no_violation", vehicleCount, violationConfidence: 0, label: topVehicle.class ?? null };
    }
    return { verdict: "no_vehicle", vehicleCount: 0, violationConfidence: 0, label: null };
  } catch {
    return SKIPPED; // timeout/network/parse — fail open
  } finally {
    clearTimeout(timer);
  }
}
