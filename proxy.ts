import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/tokens";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * - /app: no session cookie, no app (sent to sign-in). The cookie is fully
 *   verified (signature and revocation) by the data access layer on every
 *   request, and row-level security applies underneath.
 * - /sign-in and /sign-up: someone already signed in goes straight to the
 *   app, so the browser "remembers" them. A stale session comes back with
 *   ?reauth=1 and is let through, so there's never a redirect loop.
 * - /: someone signed in who opens the site (typed address, bookmark,
 *   reopened tab, a link from elsewhere) lands on their dashboard. Following
 *   a link to the homepage from inside Locenti (Sec-Fetch-Site: same-origin)
 *   still shows it, so pricing and the rest stay reachable.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (pathname === "/") {
    const fromInside = request.headers.get("sec-fetch-site") === "same-origin";
    if (token && !fromInside && !searchParams.has("home") && (await validSession(token))) {
      const to = request.nextUrl.clone();
      to.pathname = "/app";
      to.search = "";
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  if (pathname === "/sign-in" || pathname === "/sign-up") {
    if (token && !searchParams.has("reauth") && (await validSession(token))) {
      const to = request.nextUrl.clone();
      to.pathname = safeNextPath(searchParams.get("next"));
      to.search = "";
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  if (!token) {
    const to = request.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

/** Signature and expiry only; the app checks revocation (a revoked session is sent to /sign-in?reauth=1). */
async function validSession(token: string) {
  const secret = process.env.SESSION_SECRET?.trim();
  return !!secret && secret.length >= 32 && !!(await verifySession(token, secret));
}

export const config = { matcher: ["/", "/app/:path*", "/sign-in", "/sign-up"] };
