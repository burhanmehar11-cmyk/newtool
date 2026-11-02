import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, resolveAppOrigin } from "@/lib/auth/oidc";
import { configuredSiteUrl, accountsConfigured, googleOAuth } from "@/server/env";

/**
 * Setup helper: shows exactly what to register in Google Cloud Console →
 * Google Auth Platform → Clients → (your web client). Contains no secrets;
 * the redirect URI is public anyway (it appears in every sign-in link).
 */
export function GET(request: NextRequest) {
  const origin = resolveAppOrigin(configuredSiteUrl(), request.nextUrl.origin);
  const clientId = googleOAuth()?.clientId ?? null;
  return NextResponse.json(
    {
      authorizedJavaScriptOrigin: origin,
      authorizedRedirectUri: callbackUrl(origin),
      clientIdInUse: clientId ? `${clientId.slice(0, 12)}…${clientId.slice(-28)}` : null,
      siteUrlSource: process.env.NEXT_PUBLIC_SITE_URL ? "NEXT_PUBLIC_SITE_URL" : process.env.VERCEL_PROJECT_PRODUCTION_URL ? "Vercel production domain" : "this request's address",
      signInConfigured: accountsConfigured(),
      note: "Copy authorizedRedirectUri exactly (https, no trailing slash) into the OAuth client's Authorized redirect URIs. Changes can take a few minutes to apply.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
