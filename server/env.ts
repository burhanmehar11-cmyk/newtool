import "server-only";

/**
 * Server configuration. Missing values produce a clear "not configured"
 * state; nothing silently falls back to demo data. Values are never logged.
 */

export type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let cachedSa: ServiceAccount | null | undefined;

/**
 * GOOGLE_SERVICE_ACCOUNT_KEY holds the service account JSON, either raw or
 * base64-encoded. One key serves Firebase Admin and the Cloud SQL connector.
 */
export function serviceAccount(): ServiceAccount | null {
  if (cachedSa !== undefined) return cachedSa;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  cachedSa = null;
  if (raw) {
    try {
      const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
      const sa = JSON.parse(json) as Partial<ServiceAccount>;
      if (sa.project_id && sa.client_email && sa.private_key) {
        cachedSa = { project_id: sa.project_id, client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, "\n") };
      }
    } catch {
      cachedSa = null;
    }
  }
  return cachedSa;
}

export type DbConfig =
  | { kind: "cloudsql"; instance: string; user: string; password: string; database: string }
  | { kind: "url"; url: string };

/** Cloud SQL via the connector in production; DATABASE_URL for local development. */
export function dbConfig(): DbConfig | null {
  const { CLOUD_SQL_INSTANCE, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL } = process.env;
  if (CLOUD_SQL_INSTANCE && DB_USER && DB_PASSWORD && DB_NAME && serviceAccount()) {
    return { kind: "cloudsql", instance: CLOUD_SQL_INSTANCE, user: DB_USER, password: DB_PASSWORD, database: DB_NAME };
  }
  if (DATABASE_URL) return { kind: "url", url: DATABASE_URL };
  return null;
}

export function firebaseWebConfigured() {
  return !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

/** Accounts need Firebase (browser + admin) and the database. */
export function accountsConfigured() {
  return firebaseWebConfigured() && !!serviceAccount() && !!dbConfig();
}
