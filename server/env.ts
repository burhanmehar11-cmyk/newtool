import "server-only";

/**
 * Server configuration. Missing values produce a clear "not configured"
 * state; nothing silently falls back to demo data. Values are never logged.
 *
 * Free setup: a Google OAuth client (Google Cloud Console, no billing) and
 * Vercel's free Postgres (Neon), which sets DATABASE_URL automatically.
 */

export function googleOAuth(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * OAuth client for "Connect Gmail". Optional separate client
 * (GMAIL_OAUTH_CLIENT_ID/SECRET); otherwise the sign-in client is reused.
 * Refresh tokens belong to the client that issued them, so changing this
 * later means reconnecting mailboxes.
 */
export function gmailOAuth(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : googleOAuth();
}

/** At least 32 characters; used to sign session and OAuth-state cookies. */
export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim();
  return s && s.length >= 32 ? s : null;
}

/** Postgres connection string. Vercel's Neon integration provides DATABASE_URL (and POSTGRES_URL). */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || null;
}

export function accountsConfigured() {
  return !!(googleOAuth() && sessionSecret() && databaseUrl());
}

/** Public site URL for sign-in redirects: NEXT_PUBLIC_SITE_URL, else Vercel's production domain. */
export function configuredSiteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : null;
}
