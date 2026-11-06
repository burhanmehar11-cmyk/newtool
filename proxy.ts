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
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (pathname === "/sign-in" || pathname === "/sign-up") {
    const secret = process.env.SESSION_SECRET?.trim();
    if (token && secret && secret.length >= 32 && !searchParams.has("reauth") && (await verifySession(token, secret))) {
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

export const config = { matcher: ["/app/:path*", "/sign-in", "/sign-up"] };
