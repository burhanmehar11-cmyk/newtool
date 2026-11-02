import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie and guards the product routes.
 * Authorisation is still enforced again in every server function and by
 * row-level security; this is only the first gate.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Not configured: pages render their own "not configured" state.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const path = request.nextUrl.pathname;

  if (path.startsWith("/app") && !signedIn) {
    const to = request.nextUrl.clone();
    to.pathname = "/sign-in";
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  if ((path === "/sign-in" || path === "/sign-up") && signedIn) {
    const to = request.nextUrl.clone();
    to.pathname = "/app";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/sign-in", "/sign-up", "/reset-password", "/auth/:path*"],
};
