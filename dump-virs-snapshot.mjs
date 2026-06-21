// Precompute the VIRS dashboard's read-only data into a static snapshot so production
// (Vercel — no Python) can serve it without the FastAPI/XGBoost service running.
//
// Usage: start the VIRS service locally (./run.ps1 in virs-service/), then from parkiq/:
//   node dump-virs-snapshot.mjs
// Writes lib/virs/snapshot.json. Re-run whenever the underlying CSV / model changes.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.VIRS_SERVICE_URL ?? "http://localhost:8000";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "lib", "virs", "snapshot.json");

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  // Confirm the service is on real data before we freeze a snapshot from it.
  const health = await get("/health");
  if (health.data_source !== "real") {
    console.warn(`⚠ data_source is "${health.data_source}" (not "real") — snapshot will reflect that.`);
  }

  const [summary, clusters, dispatchRoi, heatmap, modelCard] = await Promise.all([
    get("/summary"),
    get("/clusters"),
    get("/dispatch-roi"),
    get("/heatmap"),
    get("/model-card"),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    dataSource: health.data_source,
    summary,
    clusters,
    dispatchRoi,
    heatmap,
    modelCard,
  };

  writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Wrote ${OUT}`);
  console.log(
    `  summary.rows=${summary.rows}, clusters=${clusters.length}, ` +
      `roi=${dispatchRoi.length}, heatmap=${heatmap.length}, dataSource=${health.data_source}`,
  );
}

main().catch((err) => {
  console.error("✗ Snapshot failed:", err.message);
  console.error("  Is the VIRS service running on", BASE, "? (./run.ps1 in virs-service/)");
  process.exit(1);
});
