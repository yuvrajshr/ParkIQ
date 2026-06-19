import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createServerClient } from "@supabase/ssr";

// `/report` = public citizen portal; `/api/citizen` = its OTP + submit endpoints.
// The controller's `/reports` page and `/api/reports/*` are intentionally NOT here, so
// they stay behind auth.
const PUBLIC_PATHS = ["/login", "/api/auth", "/report", "/api/citizen"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // 1. Check Supabase session
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) return response;
  }

  // 2. Check fallback JWT cookie
  const jwtSecret = process.env.JWT_SECRET;
  const token = request.cookies.get("auth-token")?.value;

  if (jwtSecret && token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      return NextResponse.next();
    } catch {
      // Token invalid or expired — fall through to redirect
    }
  }

  // 3. Not authenticated — mobile goes to citizen portal, desktop to login
  const ua = request.headers.get("user-agent") ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = isMobile ? "/report" : "/login";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
