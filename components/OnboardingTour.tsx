"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { Config, DriveStep } from "driver.js";

// ── Credentials ──────────────────────────────────────────────────────────────

const DEMO_EMAIL = "admin@astram.gov.in";
const DEMO_PASSWORD = "ParkIQ@2026!";

// ── localStorage keys ─────────────────────────────────────────────────────────

const KEY_LOGIN = "parkiq-tour-login-seen";
const KEY_DASH = "parkiq-tour-dash-seen";
const KEY_CITIZEN = "parkiq-citizen-tour-seen";

// ── Singleton driver instance ─────────────────────────────────────────────────

let active: ReturnType<typeof driver> | null = null;

function destroyActive() {
  try {
    active?.destroy();
  } catch {
    // ignore if already destroyed
  }
  active = null;
}

// ── Auto-fill React controlled input via native setter ────────────────────────
// React 19 listens to native 'input' events, so this triggers the onChange handler.

function fillReactInput(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ── Shared driver config ──────────────────────────────────────────────────────

const COMMON: Partial<Config> = {
  popoverClass: "ptour-popover",
  overlayColor: "rgba(0,0,0,0.72)",
  animate: true,
  smoothScroll: true,
  allowClose: true,
  showProgress: true,
};

// ── Credential HTML block used in login step 1 ────────────────────────────────

function credBlock(): string {
  const copy = (v: string) => `onclick="navigator.clipboard?.writeText('${v}')"`;
  return `
    <p style="margin-bottom:8px">Use these credentials to sign in:</p>
    <span class="ptour-label">Email</span>
    <div class="ptour-cred">
      <span class="ptour-val">${DEMO_EMAIL}</span>
      <button class="ptour-copy" ${copy(DEMO_EMAIL)}>copy</button>
    </div>
    <span class="ptour-label">Password</span>
    <div class="ptour-cred">
      <span class="ptour-val">${DEMO_PASSWORD}</span>
      <button class="ptour-copy" ${copy(DEMO_PASSWORD)}>copy</button>
    </div>
    <p style="margin-top:10px;font-size:11.5px;color:#52525b">
      Credentials are filled in automatically on the next step.
    </p>
  `;
}

// ── Tour: login page ──────────────────────────────────────────────────────────

function startLoginTour() {
  destroyActive();

  const steps: DriveStep[] = [
    {
      popover: {
        title: "Welcome to ParkIQ — Demo Access",
        description: credBlock(),
        side: "over",
        align: "center",
        nextBtnText: "Fill credentials →",
      },
    },
    {
      element: "#tour-login-form",
      onHighlighted: () => {
        fillReactInput("email", DEMO_EMAIL);
        fillReactInput("password", DEMO_PASSWORD);
      },
      popover: {
        title: "Ready to sign in",
        description:
          "Your credentials have been filled in. Click <strong>Sign In</strong> to enter the Command Centre.",
        side: "top",
        align: "center",
        nextBtnText: "Got it",
      },
    },
  ];

  active = driver({ ...COMMON, steps });
  active.drive();
}

// ── Tour: police dashboard ────────────────────────────────────────────────────

export function startDashboardTour() {
  destroyActive();

  const steps: DriveStep[] = [
    {
      popover: {
        title: "ParkIQ Command Centre",
        description:
          "Real-time Violation Impact Risk Scoring for Bengaluru Traffic Police. Let's walk through the key features in under 60 seconds.",
        side: "over",
        align: "center",
      },
    },
    {
      element: "#tour-mode-toggle",
      popover: {
        title: "VIRS vs Simulation Mode",
        description:
          "Toggle between <strong>VIRS mode</strong> (XGBoost risk scoring on 119k records) and <strong>Simulation mode</strong> (live dispatch simulator with clock control).",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-virs-kpis",
      popover: {
        title: "Violation Impact Risk Score",
        description:
          "XGBoost model (AUC&nbsp;0.91) scores every enforcement cluster 0–100 by congestion impact. High-risk clusters surface to the top.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#tour-virs-map",
      popover: {
        title: "Live Risk Heatmap",
        description:
          "Bengaluru's highest-risk parking zones. Brighter = higher VIRS score. Click a cluster to drill into its vehicle mix and peak-hour share.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#tour-dispatch-queue",
      popover: {
        title: "Dispatch Priority Queue",
        description:
          "Clusters ranked by ROI: expected congestion relief per officer deployed. Send wardens where the traffic impact is highest.",
        side: "left",
        align: "start",
      },
    },
    {
      element: "#tour-ai-button",
      popover: {
        title: "VIRS AI Insights",
        description:
          "Ask the AI assistant about violation patterns, risk trends, or dispatch recommendations — all grounded in live model data.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#tour-reports-link",
      popover: {
        title: "Citizen Reports",
        description:
          "Real-time parking reports submitted via the public ParkIQ portal — each AI-verified with a live photo and GPS pin. Try submitting one from your phone.",
        side: "bottom",
        align: "end",
        nextBtnText: "Done",
      },
    },
  ];

  // Skip steps whose target isn't mounted (e.g. VIRS-only panels while in Sim mode),
  // so a manually triggered tour never highlights an empty region.
  const present = steps.filter(
    (s) => !s.element || typeof s.element !== "string" || !!document.querySelector(s.element),
  );

  active = driver({ ...COMMON, steps: present });
  active.drive();
}

// ── Tour: citizen report portal ───────────────────────────────────────────────

function startCitizenTour() {
  destroyActive();

  const steps: DriveStep[] = [
    {
      popover: {
        title: "Report a Parking Violation",
        description:
          "Help Bengaluru Traffic Police respond faster. Three steps: verify your number, snap a photo, and submit. It appears live on the Command Centre in seconds.",
        side: "over",
        align: "center",
        nextBtnText: "Show me →",
      },
    },
    {
      element: "#phone",
      popover: {
        title: "Step 1 — Verify your number",
        description:
          "Enter your 10-digit mobile number. You'll receive an OTP to confirm your identity. For the demo, the code appears on screen.",
        side: "bottom",
        align: "center",
      },
    },
    {
      popover: {
        title: "Steps 2 & 3 — Photo + Submit",
        description:
          "After OTP verification: take a photo of the violation and share your GPS location. Our AI checks for a visible vehicle before sending the report to the Command Centre.",
        side: "over",
        align: "center",
        nextBtnText: "Let's go",
      },
    },
  ];

  active = driver({ ...COMMON, steps });
  active.drive();
}

// ── Dark-theme styles for all tour popovers ───────────────────────────────────

const TOUR_STYLE = `
.ptour-popover.driver-popover {
  background: rgba(12,12,18,0.97) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: 16px !important;
  box-shadow: 0 24px 80px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.04) inset !important;
  max-width: 380px !important;
  padding: 20px 22px 18px !important;
  font-family: var(--font-body, system-ui, sans-serif) !important;
}
.ptour-popover .driver-popover-title {
  color: #f0f0f4 !important;
  font-size: 14.5px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  margin-bottom: 6px !important;
  line-height: 1.4 !important;
}
.ptour-popover .driver-popover-description {
  color: #a1a1aa !important;
  font-size: 13px !important;
  line-height: 1.65 !important;
}
.ptour-popover .driver-popover-description strong {
  color: #e4e4e7 !important;
  font-weight: 600 !important;
}
.ptour-popover .driver-popover-footer {
  margin-top: 16px !important;
  padding-top: 14px !important;
  border-top: 1px solid rgba(255,255,255,0.07) !important;
  gap: 8px !important;
}
.ptour-popover .driver-popover-prev-btn {
  background: transparent !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: #71717a !important;
  border-radius: 8px !important;
  font-size: 12px !important;
  padding: 5px 13px !important;
  text-shadow: none !important;
}
.ptour-popover .driver-popover-prev-btn:hover {
  border-color: rgba(255,255,255,0.22) !important;
  color: #a1a1aa !important;
}
.ptour-popover .driver-popover-next-btn {
  background: #1b5fb0 !important;
  border: none !important;
  color: #fff !important;
  border-radius: 8px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  padding: 5px 15px !important;
  text-shadow: none !important;
}
.ptour-popover .driver-popover-next-btn:hover {
  background: #2468c0 !important;
}
.ptour-popover .driver-popover-close-btn {
  color: #52525b !important;
  top: 14px !important;
  right: 16px !important;
}
.ptour-popover .driver-popover-close-btn:hover {
  color: #a1a1aa !important;
  background: transparent !important;
}
.ptour-popover .driver-popover-progress-text {
  color: #3f3f46 !important;
  font-size: 11px !important;
}
/* Arrow colours */
.ptour-popover.driver-popover-placement-top .driver-popover-arrow {
  border-top-color: rgba(12,12,18,0.97) !important;
}
.ptour-popover.driver-popover-placement-bottom .driver-popover-arrow {
  border-bottom-color: rgba(12,12,18,0.97) !important;
}
.ptour-popover.driver-popover-placement-left .driver-popover-arrow {
  border-left-color: rgba(12,12,18,0.97) !important;
}
.ptour-popover.driver-popover-placement-right .driver-popover-arrow {
  border-right-color: rgba(12,12,18,0.97) !important;
}
/* Credential block */
.ptour-label {
  display: block;
  color: #52525b;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 10px;
  margin-bottom: 3px;
}
.ptour-cred {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: #d4d4d8;
  font-family: var(--font-mono, monospace);
}
.ptour-val { flex: 1; word-break: break-all; }
.ptour-copy {
  cursor: pointer;
  color: #52525b;
  font-size: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  border-radius: 4px;
  padding: 2px 7px;
  transition: color 0.15s;
  white-space: nowrap;
  font-family: inherit;
}
.ptour-copy:hover { color: #a1a1aa; }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingTour() {
  const pathname = usePathname();

  // Inject dark-theme CSS once into <head>
  useEffect(() => {
    if (document.getElementById("ptour-css")) return;
    const el = document.createElement("style");
    el.id = "ptour-css";
    el.textContent = TOUR_STYLE;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // Login is unambiguous by URL.
    if (pathname === "/login") {
      if (!localStorage.getItem(KEY_LOGIN)) {
        localStorage.setItem(KEY_LOGIN, "1");
        timer = setTimeout(startLoginTour, 700);
      }
      return () => {
        clearTimeout(timer);
        destroyActive();
      };
    }

    // For "/" and "/report" the rendered experience depends on the deployment:
    // the citizen project (APP_MODE=citizen) rewrites every route to the report
    // form, so the browser path is "/" while the page is actually the citizen
    // portal. Decide by what's on the page, not the URL — otherwise the dashboard
    // tour leaks onto the citizen site (and the citizen tour never fires there).
    if (pathname === "/" || pathname === "/report") {
      // Delay lets the dashboard panels / citizen form finish mounting.
      timer = setTimeout(() => {
        const isCitizen = !!document.getElementById("tour-citizen-form");
        const isDashboard = !!document.getElementById("tour-mode-toggle");
        if (isCitizen && !localStorage.getItem(KEY_CITIZEN)) {
          localStorage.setItem(KEY_CITIZEN, "1");
          startCitizenTour();
        } else if (isDashboard && !localStorage.getItem(KEY_DASH)) {
          localStorage.setItem(KEY_DASH, "1");
          startDashboardTour();
        }
      }, 1400);
    }

    return () => {
      clearTimeout(timer);
      destroyActive();
    };
  }, [pathname]);

  return null;
}
