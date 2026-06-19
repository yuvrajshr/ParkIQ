import { SignJWT, jwtVerify } from "jose";

// App-level citizen session: issued after a successful phone-OTP check, carried in an
// httpOnly cookie, and required by POST /api/citizen/report. Citizens are NOT Supabase
// users — this is the only thing that proves "this phone was verified".

export const CITIZEN_COOKIE = "citizen-token";
const ONE_HOUR = 60 * 60;

function secret(): Uint8Array | null {
  const s = process.env.CITIZEN_JWT_SECRET;
  return s ? new TextEncoder().encode(s) : null;
}

/** "+919900050210" -> "+91 ●●●●● ●210" — safe to store and show; not reversible PII. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last3 = digits.slice(-3) || "000";
  return `+91 ●●●●● ●${last3}`;
}

export async function signCitizenToken(maskedPhone: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  return new SignJWT({ maskedPhone, role: "citizen" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ONE_HOUR}s`)
    .sign(key);
}

export interface CitizenClaims {
  maskedPhone: string;
}

export async function verifyCitizenToken(token: string | undefined): Promise<CitizenClaims | null> {
  const key = secret();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.role !== "citizen" || typeof payload.maskedPhone !== "string") return null;
    return { maskedPhone: payload.maskedPhone };
  } catch {
    return null;
  }
}
