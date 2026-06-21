import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { twilioCheck, isTwilioConfigured } from "@/lib/otp/verify";
import { verifyChallenge, OTP_CHALLENGE_COOKIE } from "@/lib/otp/challenge";
import { CITIZEN_COOKIE, maskPhone, signCitizenToken } from "@/lib/citizen/session";

// Public route. Verifies the OTP and, on success, issues the short-lived citizen-token
// cookie that POST /api/citizen/report requires.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").trim();
  const code = String(body.code ?? "").trim();

  if (!phone || !code) {
    return NextResponse.json({ ok: false, error: "Phone and code required" }, { status: 400 });
  }

  // A mock/trial-fallback challenge cookie means this number got an on-screen code, not a
  // Twilio SMS — verify against the cookie. Otherwise it's a real Twilio verification.
  const cookieStore = await cookies();
  const challenge = cookieStore.get(OTP_CHALLENGE_COOKIE)?.value;

  let ok: boolean;
  if (challenge) {
    ok = await verifyChallenge(challenge, phone, code);
  } else if (isTwilioConfigured()) {
    ok = (await twilioCheck(phone, code)).ok;
  } else {
    ok = false;
  }

  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid or expired code" }, { status: 401 });
  }

  const token = await signCitizenToken(maskPhone(phone));
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Session signing not configured (set CITIZEN_JWT_SECRET)" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CITIZEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  // Consume the challenge so the code can't be replayed.
  response.cookies.set(OTP_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
