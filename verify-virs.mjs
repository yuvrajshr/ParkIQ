// End-to-end check: Next /api/virs/* proxy → Python VIRS service. Mints a fallback auth-token
// (HS256 via JWT_SECRET) so the auth middleware lets the API requests through. Prints only small
// derived summaries. Run: node verify-virs.mjs
import fs from "node:fs";
import crypto from "node:crypto";

const env = fs.readFileSync(".env.local", "utf8");
const secret = (env.match(/^JWT_SECRET=(.*)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
if (!secret) {
  console.log("no JWT_SECRET in .env.local");
  process.exit(1);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ sub: "verify", iat: now, exp: now + 600 });
const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
const token = `${head}.${body}.${sig}`;
const headers = { Cookie: `auth-token=${token}` };

const BASE = "http://localhost:3000";
const paths = [
  "/api/virs/summary",
  "/api/virs/clusters",
  "/api/virs/dispatch-roi",
  "/api/virs/model-card",
  "/api/virs/cluster/0",
];

for (const p of paths) {
  try {
    const r = await fetch(BASE + p, { headers, redirect: "manual" });
    const j = await r.json().catch(() => ({}));
    let info;
    if (p.endsWith("summary")) info = j.summary;
    else if (p.endsWith("clusters")) info = j.ok ? `${j.clusters.length} clusters; top avgVirs=${j.clusters[0].avgVirs}` : j.error;
    else if (p.endsWith("dispatch-roi")) info = j.ok ? `${j.items.length} items; top roi=${j.items[0].roi} cluster=${j.items[0].clusterId}` : j.error;
    else if (p.endsWith("model-card")) info = j.ok ? `auc=${j.modelCard.validationAuc}, caveats=${j.modelCard.knownCaveats.length}` : j.error;
    else info = j.ok ? `cluster ${j.cluster.clusterId} avgVirs=${j.cluster.avgVirs}` : j.error;
    console.log(r.status, p, "->", JSON.stringify(info));
  } catch (e) {
    console.log("ERR", p, e.message);
  }
}
