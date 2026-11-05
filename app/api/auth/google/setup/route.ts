import { NextResponse, type NextRequest } from "next/server";
import { callbackUrl, resolveAppOrigin } from "@/lib/auth/oidc";
import { gmailCallbackUrl } from "@/lib/gmail/oauth";
import { configuredSiteUrl, accountsConfigured, gmailOAuth, googleOAuth } from "@/server/env";

/**
 * Setup helper: shows exactly what to register in Google Cloud Console →
 * Google Auth Platform → Clients → (your web client). Contains no secrets;
 * the redirect URI is public anyway (it appears in every sign-in link).
 */
export function GET(request: NextRequest) {
  const origin = resolveAppOrigin(configuredSiteUrl(), request.nextUrl.origin);
  const clientId = googleOAuth()?.clientId ?? null;
  const gmailId = gmailOAuth()?.clientId ?? null;
  const mask = (id: string | null) => (id ? `${id.slice(0, 12)}…${id.slice(-28)}` : null);
  return NextResponse.json(
    {
      authorizedJavaScriptOrigin: origin,
      authorizedRedirectUri: callbackUrl(origin),
      clientIdInUse: mask(clientId),
      gmailRedirectUri: gmailCallbackUrl(origin),
      gmailClientIdInUse: mask(gmailId),
      gmailClient: process.env.GMAIL_OAUTH_CLIENT_ID?.trim() && process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim() ? "separate (GMAIL_OAUTH_CLIENT_ID)" : "same as sign-in",
      siteUrlSource: process.env.NEXT_PUBLIC_SITE_URL ? "NEXT_PUBLIC_SITE_URL" : process.env.VERCEL_PROJECT_PRODUCTION_URL ? "Vercel production domain" : "this request's address",
      signInConfigured: accountsConfigured(),
      note: "Copy authorizedRedirectUri and gmailRedirectUri exactly (https, no trailing slash) into the Authorized redirect URIs of the client shown in clientIdInUse / gmailClientIdInUse. Changes can take a few minutes to apply.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
