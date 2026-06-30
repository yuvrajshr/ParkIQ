# ParkIQ — Bengaluru Traffic Command

> **Stop counting violations. Start pricing them.**

ParkIQ is a real-time commander dashboard for Bengaluru Traffic Police that turns illegal parking data into an economic signal — ranking every hotspot by the actual traffic damage it causes, not just how many cars are parked.

**Live demo:**
- Commander dashboard → [parkiq-dashboard.vercel.app](https://parkiq-dashboard.vercel.app)
- Citizen portal → [parkiq-report.vercel.app](https://parkiq-report.vercel.app)

Login: `admin@astram.gov.in` / `ParkIQ@2026!`

---

## The Core Insight

Every road has a `sensitivityKmphPerVehicle` — how much speed it loses per illegally parked car. Multiply by live traffic volume and you get a **Congestion Impact Score (CIS, 0–100)**. Once violations are priced in traffic terms, the system can:

| What | How |
|---|---|
| **Score** | Live heat map of hotspots ranked by CIS |
| **Predict** | XGBoost ML model (AUC 0.9614) flags clusters likely to bottleneck *before* they do |
| **Dispatch** | Send the nearest warden to the highest-impact spot first, not the closest complaint |
| **Learn** | Measure whether speed recovered after dispatch; flag chronic relapses |

---

## Features

### VIRS — Violation Impact & Risk Scoring
- **XGBoost ML model** trained on 119,418 real violations across Bengaluru (AUC 0.9614)
- 1,061 violation clusters scored; top 60 surfaced with per-zone stratification (3 Critical · 3 High · 3 Medium · 3 Low per zone × 5 zones)
- Severity de-saturated via log-odds rescaling — no more "everything is Critical"
- Native road names from OSM labels parquet (Gubbi Thotadappa Road, Lalbagh Road, etc.)
- Live Python microservice on DigitalOcean, proxied by Next.js — real ML in production

### AI Dispatch Priority Queue
- Clusters ranked by ROI: `avg_virs × log1p(count) × peak_hour_weight`
- Filter by zone (Central / North / South / East / West Bengaluru)
- Severity badges, ROI progress bar, animated reordering on zone switch

### Citizen Violation Reporting
- Phone OTP → camera capture → GPS snap → Supabase Realtime
- **Roboflow YOLO** two-model pipeline: vehicle presence gate (YOLOv8n-640) + illegal parking detection (0.96 max confidence)
- **Gemini moderation**: offline blocklist pre-guard + AI classify before any upload
- Live `NewReportAlert` stacks in the dashboard top-right with amber countdown bar

### CCTV Feed
- Per-road CCTV violation gallery with AI confidence scores
- Combined CCTV + citizen view per road at `/violations/[roadId]`
- Global violations index at `/violations` across all roads and sources

### PDF Intelligence Report
- On-demand 8-page ASTRaM-letterhead PDF (`/report-builder`)
- Sections: Cover, Executive Summary, VIRS Hotspot Analysis, Citizen Reports, CCTV, Dispatch Activity, AI Recommendations, Model Transparency
- **Gemini** generates a 3-paragraph narrative with `▲/▼` week-over-week delta annotations
- SVG charts hand-rolled for react-pdf (no charting library needed)

### AI Insights Chat
- Gemini-powered conversational assistant grounded in live dashboard state
- Cross-session history summary

### Simulation Mode
- Deterministic Friday 17:30→19:00 traffic simulation, 200ms tick at 1.5× speed
- Warden dispatch, ETA, and speed-recovery tracking per road

### Internationalisation
- Full English / हिन्दी / ಕನ್ನಡ — 220+ keys, 6 VIRS components, all UI strings
- Pre-paint language bootstrap (no flash on reload)

### Onboarding Tour
- Driver.js tour auto-starts on first visit
- Shows demo credentials, auto-fills the login form
- Separate tours for dashboard (7 steps) and citizen portal (3 steps)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Vercel (Next.js 16 App Router)                          │
│  ┌───────────────────┐   ┌────────────────────────────┐  │
│  │ parkiq-dashboard  │   │ parkiq-report              │  │
│  │ /login  /  /rpts  │   │ citizen portal (/report)   │  │
│  └─────────┬─────────┘   └────────────────────────────┘  │
│            │  /api/virs/*  (server-only proxy)            │
└────────────┼─────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  DigitalOcean App Platform     │
│  FastAPI + XGBoost 3.2.0       │
│  119,418 rows · AUC 0.9614    │
│  /health /clusters /score      │
└────────────────────────────────┘
             +
┌────────────────────────────────┐
│  Supabase (ap-northeast-1)     │
│  citizen_reports  · Realtime   │
│  cctv_violations               │
│  violation-photos bucket       │
└────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9, App Router, TypeScript |
| UI | React 19, Tailwind v4, Framer Motion |
| ML Service | FastAPI + XGBoost 3.2.0 (Python 3.11) |
| Maps | Google Maps JS API v2 (custom dark/light styles, DOM overlays) |
| AI | Gemini 1.5 Flash (narrative + moderation), Roboflow YOLO (vision) |
| Auth | Supabase Auth + stateless OTP (JWT, `jose`) |
| Database | Supabase Postgres + Realtime |
| i18n | Zustand + custom `t()` hook, flat JSON locale files |
| Deployment | Vercel (frontend × 2) + DigitalOcean App Platform (ML service) |

---

## ML Model Details

The VIRS model is an **XGBoost binary classifier** (`binary:logistic`) predicting P(traffic bottleneck) for a violation cluster.

- **Training data:** 119,418 georeferenced parking violations, Bengaluru
- **Features (12):** cluster density, peak-hour share, road FRC vulnerability, estimated vehicle width, and spatial/temporal aggregates
- **Validation AUC:** 0.9645
- **Severity scoring:** raw sigmoid output de-saturated via log-odds → min-max scaled to 0–100
- **Clustering:** HDBSCAN spatial clusters, noise-filtered (≥3 violations), per-zone stratified selection

---

## Run Locally

> **Note:** `.env` / `.env.local` are not included in the repository — you must create your own from `.env.example` and supply your own API keys. See the table below for every variable and where to get it.

### Option A — Docker

```bash
git clone https://github.com/yuvrajshr/ParkIQ
cd ParkIQ/parkiq

cp .env.example .env
# Fill in .env with your API keys

docker compose up --build
# → http://localhost:3000
```

### Option B — Dev server

**Prerequisites:** Node 20+, Python 3.11+

```bash
# Terminal 1 — VIRS Python service
cd ParkIQ/parkiq/virs-service
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Next.js
cd ParkIQ/parkiq
npm install
cp .env.example .env.local   # fill in keys
npm run dev
# → http://localhost:3000
```

**Login:** `admin@astram.gov.in` / `ParkIQ@2026!`

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | For server-side writes |
| `JWT_SECRET` | Yes | Any 32+ char string |
| `CITIZEN_JWT_SECRET` | Yes | Any 32+ char string |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Yes | Commander login credentials |
| `GEMINI_API_KEY` | Yes | Free at aistudio.google.com |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Maps JS API (billing-enabled key) |
| `ROBOFLOW_API_KEY` | Optional | AI verdicts disabled if absent |
| `TWILIO_*` | Optional | Falls back to mock OTP (logged to console) |
| `VIRS_SERVICE_URL` | Auto | Set automatically by Docker Compose |

---

*Built for ASTRaM — Advanced System for Traffic Resource and Analytics Management*
