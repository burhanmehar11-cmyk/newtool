import "server-only";

/**
 * Reports which production providers are configured, without exposing values.
 * In M1 nothing is wired, so everything reports "not configured" and the
 * product runs only the clearly labelled demo.
 */
export type ProviderStatus = {
  key: "auth" | "discovery" | "verification" | "ai" | "mailbox" | "billing" | "database";
  label: string;
  configured: boolean;
  envVars: string[];
  milestone: "M2" | "M3";
};

const has = (name: string) => typeof process.env[name] === "string" && process.env[name]!.length > 0;

export function getProviderStatus(): ProviderStatus[] {
  const rows: Omit<ProviderStatus, "configured">[] = [
    { key: "auth", label: "Accounts (Firebase Authentication)", envVars: ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "GOOGLE_SERVICE_ACCOUNT_KEY"], milestone: "M2" },
    { key: "database", label: "Database (Cloud SQL for PostgreSQL)", envVars: ["CLOUD_SQL_INSTANCE", "DB_USER", "DB_PASSWORD", "DB_NAME", "GOOGLE_SERVICE_ACCOUNT_KEY"], milestone: "M2" },
    { key: "discovery", label: "Business discovery", envVars: ["DISCOVERY_PROVIDER", "DISCOVERY_API_KEY"], milestone: "M2" },
    { key: "verification", label: "Email verification", envVars: ["VERIFICATION_PROVIDER", "VERIFICATION_API_KEY"], milestone: "M2" },
    { key: "ai", label: "AI research and drafts (Anthropic)", envVars: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"], milestone: "M2" },
    { key: "mailbox", label: "Gmail sending", envVars: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY"], milestone: "M2" },
    { key: "billing", label: "Billing", envVars: ["BILLING_PROVIDER", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], milestone: "M3" },
  ];
  return rows.map((r) => ({ ...r, configured: r.envVars.every(has) }));
}
