import { NextResponse } from "next/server";
import { startOtp } from "@/lib/otp/verify";
import { signChallenge, OTP_CHALLENGE_COOKIE } from "@/lib/otp/challenge";

// Public route (whitelisted in proxy.ts). Sends an OTP via Twilio Verify, or — when
// Twilio isn't configured or rejects a trial/unverified number — issues a mock code
// sealed into the signed otp-challenge cookie that /otp/check verifies against.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").trim();

  // Expect E.164, e.g. +91XXXXXXXXXX. Keep the check light — Twilio is the real validator.
  if (!/^\+\d{8,15}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "Enter a valid phone number" }, { status: 400 });
  }

  const result = await startOtp(phone);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Could not send code" }, { status: 502 });
  }

  // devCode is only ever present in mock mode (real Twilio sends never return it).
  const response = NextResponse.json({ ok: true, mock: result.mock, devCode: result.code });

  if (result.mock && result.code) {
    // Seal the mock code into a short-lived signed cookie for the check step.
    const challenge = await signChallenge(phone, result.code);
    if (challenge) {
      response.cookies.set(OTP_CHALLENGE_COOKIE, challenge, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 5,
        secure: process.env.NODE_ENV === "production",
      });
    }
  } else {
    // Real SMS sent — drop any stale mock challenge so check can't use an old code.
    response.cookies.set(OTP_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return response;
}
