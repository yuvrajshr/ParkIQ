import { SignJWT, jwtVerify } from "jose";

// Stateless mock-OTP challenge. When the OTP layer issues a mock code (pure mock or
// Twilio trial fallback), the start route seals {phone, code} into this short-lived,
// httpOnly, signed cookie. The check route verifies the submitted code against it — no
// shared server memory, so it survives separate route bundles, HMR, and serverless.

export const OTP_CHALLENGE_COOKIE = "otp-challenge";
const FIVE_MIN = 60 * 5;

function secret(): Uint8Array | null {
  const s = process.env.CITIZEN_JWT_SECRET;
  return s ? new TextEncoder().encode(s) : null;
}

export async function signChallenge(phone: string, code: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  return new SignJWT({ phone, code })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${FIVE_MIN}s`)
    .sign(key);
}

export async function verifyChallenge(
  token: string | undefined,
  phone: string,
  code: string,
): Promise<boolean> {
  const key = secret();
  if (!key || !token) return false;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.phone === phone && payload.code === code.trim();
  } catch {
    return false;
  }
}
