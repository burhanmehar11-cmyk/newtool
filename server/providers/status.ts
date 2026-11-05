import "server-only";

/**
 * Reports which production providers are configured, without exposing values.
 * In M1 nothing is wired, so everything reports "not configured" and the
 * product runs only the clearly labelled demo.
 */
export type ProviderStatus = {
  key: "auth" | "discovery" | "googleMaps" | "verification" | "ai" | "mailbox" | "billing" | "database";
  label: string;
  configured: boolean;
  envVars: string[];
  milestone: "M2" | "M3";
};

const has = (name: string) =>
  (typeof process.env[name] === "string" && process.env[name]!.length > 0) || (name === "DATABASE_URL" && !!process.env.POSTGRES_URL);

export function getProviderStatus(): ProviderStatus[] {
  const rows: Omit<ProviderStatus, "configured">[] = [
    { key: "auth", label: "Sign in with Google", envVars: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "SESSION_SECRET"], milestone: "M2" },
    { key: "database", label: "Database (Postgres)", envVars: ["DATABASE_URL"], milestone: "M2" },
    { key: "discovery", label: "Business discovery (OpenStreetMap, free, no key needed)", envVars: [], milestone: "M2" },
    { key: "googleMaps", label: "Google Maps search (Places API)", envVars: ["GOOGLE_PLACES_API_KEY"], milestone: "M2" },
    { key: "verification", label: "Email verification", envVars: ["VERIFICATION_PROVIDER", "VERIFICATION_API_KEY"], milestone: "M2" },
    { key: "ai", label: "AI research and drafts (Anthropic)", envVars: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"], milestone: "M2" },
    { key: "mailbox", label: "Gmail sending (same Google client, send permission asked when connecting)", envVars: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "SESSION_SECRET"], milestone: "M2" },
    { key: "billing", label: "Billing", envVars: ["BILLING_PROVIDER", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], milestone: "M3" },
  ];
  return rows.map((r) => ({ ...r, configured: r.envVars.every(has) }));
}
