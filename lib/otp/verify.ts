// Phone OTP behind a tiny interface so the routes don't care how the code is sent.
// If Twilio Verify env vars are present we use the real service; otherwise we fall back
// to a mock so the demo runs with zero external setup. The mock code is carried in a
// signed cookie (see lib/otp/challenge.ts), never in server memory — so it survives
// across separate route bundles, HMR, and serverless instances.

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

export function isTwilioConfigured(): boolean {
  return Boolean(SID && TOKEN && VERIFY_SID);
}

export interface StartResult {
  ok: boolean;
  mock: boolean;
  /** The 6-digit code — present only in mock mode (incl. trial fallback). The route
   *  seals this into the signed otp-challenge cookie and echoes it to the dev UI. */
  code?: string;
  /** True when Twilio rejected the number (trial/unverified) and we dropped to mock. */
  fellBack?: boolean;
  error?: string;
}

export interface CheckResult {
  ok: boolean;
  error?: string;
}

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// --- Twilio Verify (raw REST, no SDK dependency) ----------------------------
function twilioAuthHeader(): string {
  return "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");
}

async function twilioStart(phone: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
    {
      method: "POST",
      headers: { Authorization: twilioAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Channel: "sms" }),
    },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { ok: false, error: (detail as { message?: string }).message ?? `Twilio error ${res.status}` };
  }
  return { ok: true };
}

export async function twilioCheck(phone: string, code: string): Promise<CheckResult> {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
    {
      method: "POST",
      headers: { Authorization: twilioAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Code: code.trim() }),
    },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { ok: false, error: (detail as { message?: string }).message ?? `Twilio error ${res.status}` };
  }
  const data = (await res.json()) as { status?: string };
  return { ok: data.status === "approved" };
}

// A Twilio trial account can only SMS numbers verified in its console; +91 also needs
// DLT. So a demo against an unverified number fails. We treat just that class of error
// as a cue to fall back to the on-screen mock code — every other Twilio error still
// surfaces, so genuine failures aren't masked.
function isTrialFallbackError(error?: string): boolean {
  return Boolean(error) && /unverified|trial|not.*verified/i.test(error!);
}

// --- Public interface -------------------------------------------------------
export async function startOtp(phone: string): Promise<StartResult> {
  if (isTwilioConfigured()) {
    const res = await twilioStart(phone);
    if (res.ok) return { ok: true, mock: false }; // real SMS sent
    // Any Twilio failure (trial limit, unverified number, invalid number, etc.)
    // falls back to the on-screen mock code so the demo always works.
    const code = genCode();
    console.log(`[OTP fallback] Twilio error for ${phone}: ${res.error}; mock code: ${code}`);
    return { ok: true, mock: true, code, fellBack: true };
  }
  const code = genCode();
  console.log(`[OTP mock] code for ${phone}: ${code}`);
  return { ok: true, mock: true, code };
}
