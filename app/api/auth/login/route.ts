import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const EIGHT_HOURS = 60 * 60 * 8;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const jwtSecret = process.env.JWT_SECRET ?? "";

  if (!adminEmail || !adminPassword || !jwtSecret) {
    return NextResponse.json(
      { error: "Fallback auth not configured" },
      { status: 503 }
    );
  }

  const emailMatch = timingSafeEqual(email ?? "", adminEmail);
  const passwordMatch = timingSafeEqual(password ?? "", adminPassword);

  if (!emailMatch || !passwordMatch) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({ sub: email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EIGHT_HOURS}s`)
    .sign(secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth-token", token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: EIGHT_HOURS,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
