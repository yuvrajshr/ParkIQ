// End-to-end check for the report builder: mints an auth-token (HS256 via JWT_SECRET), hits
// /api/report/preview (counts) and /api/report/generate (PDF), and writes the PDF to disk so
// you can open and eyeball it. Run: node verify-report.mjs   (dev server must be on :3000)
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
const headers = { Cookie: `auth-token=${head}.${body}.${sig}`, "Content-Type": "application/json" };

const BASE = "http://localhost:3000";
const config = {
  zones: ["All"],
  preset: "last30d",
  sections: {
    executiveSummary: true,
    virsHotspots: true,
    citizenReports: true,
    cctvDetections: true,
    dispatchActivity: true,
    aiRecommendations: true,
    modelTransparency: true,
  },
};

// 1) preview
try {
  const r = await fetch(`${BASE}/api/report/preview`, {
    method: "POST",
    headers,
    body: JSON.stringify(config),
    redirect: "manual",
  });
  const j = await r.json().catch(() => ({}));
  console.log("preview", r.status, JSON.stringify(j.ok ? j.outline.counts : j.error));
} catch (e) {
  console.log("preview ERR", e.message);
}

// 2) generate
try {
  const r = await fetch(`${BASE}/api/report/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(config),
    redirect: "manual",
  });
  const ct = r.headers.get("content-type");
  if (r.status === 200 && ct?.includes("pdf")) {
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync("verify-report-output.pdf", buf);
    const isPdf = buf.slice(0, 5).toString() === "%PDF-";
    console.log("generate", r.status, `${buf.length} bytes`, isPdf ? "valid PDF header ✓" : "NOT a PDF ✗", "→ verify-report-output.pdf");
  } else {
    const txt = await r.text();
    console.log("generate", r.status, ct, txt.slice(0, 300));
  }
} catch (e) {
  console.log("generate ERR", e.message);
}
