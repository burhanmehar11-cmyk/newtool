import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SIGNED_IN_COOKIE } from "@/lib/auth/constants";
import { accountsConfigured } from "@/server/env";
import { withService } from "@/server/db";
import { verifyEmail, type Q } from "@/server/auth-store";
import { newSessionToken, sessionCookieOptions, signedInHintOptions } from "@/server/session";

/** Email confirmation link: verifies the address, signs the user in, continues to setup. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!accountsConfigured() || !token || token.length > 200) return NextResponse.redirect(new URL("/sign-in?error=link", request.url));
  const userId = await withService((q) => verifyEmail(q as unknown as Q, token)).catch(() => null);
  if (!userId) return NextResponse.redirect(new URL("/sign-in?error=link", request.url));
  const res = NextResponse.redirect(new URL("/app", request.url));
  res.cookies.set(SESSION_COOKIE, await newSessionToken(userId, request.headers.get("user-agent")), sessionCookieOptions);
  res.cookies.set(SIGNED_IN_COOKIE, "1", signedInHintOptions);
  return res;
}
