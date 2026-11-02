import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-policy";

/**
 * First gate for the product: no session cookie, no /app. The cookie is
 * fully verified (signature and revocation) by the data access layer on
 * every request, and row-level security applies underneath.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const to = request.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
