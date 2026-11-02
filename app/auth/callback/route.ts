import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/supabase/server";

/** Email confirmation and password-reset links land here (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();
  if (!supabase || !code) return NextResponse.redirect(new URL("/sign-in?error=link", request.url));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/sign-in?error=link" : next, request.url));
}
