import "server-only";
import pg from "pg";
import { AuthTypes, Connector, GoogleAuth, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { dbConfig, serviceAccount } from "@/server/env";
import { USER_SCOPE_SQL } from "@/server/db-sql";

export type Queryable = Pick<pg.PoolClient, "query">;

let poolPromise: Promise<pg.Pool> | null = null;

async function createPool(): Promise<pg.Pool> {
  const cfg = dbConfig();
  if (!cfg) throw new Error("Database is not configured");
  if (cfg.kind === "url") return new pg.Pool({ connectionString: cfg.url, max: 5 });
  const sa = serviceAccount()!;
  // The connector uses the service account (role: Cloud SQL Client) to open an
  // mTLS tunnel. No IP allowlist is needed, which suits Vercel's dynamic IPs.
  const connector = new Connector({
    auth: new GoogleAuth({
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
      projectId: sa.project_id,
      scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
    }),
  });
  const opts = await connector.getOptions({ instanceConnectionName: cfg.instance, ipType: IpAddressTypes.PUBLIC, authType: AuthTypes.PASSWORD });
  return new pg.Pool({ ...opts, user: cfg.user, password: cfg.password, database: cfg.database, max: 5, idleTimeoutMillis: 10_000 });
}

function pool() {
  poolPromise ??= createPool().catch((e) => {
    poolPromise = null;
    throw e;
  });
  return poolPromise;
}

async function transaction<T>(scope: (c: pg.PoolClient) => Promise<void>, fn: (q: Queryable) => Promise<T>): Promise<T> {
  const client = await (await pool()).connect();
  try {
    await client.query("begin");
    await scope(client);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Runs as the signed-in user: row-level security applies to every statement. */
export function withUser<T>(userId: string, fn: (q: Queryable) => Promise<T>): Promise<T> {
  return transaction(async (c) => {
    await c.query(USER_SCOPE_SQL.role);
    await c.query(USER_SCOPE_SQL.setUser, [userId]);
  }, fn);
}

/** Privileged access for server-only bookkeeping (e.g. mapping Firebase UIDs). Never pass user input as SQL. */
export function withService<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return transaction(async () => undefined, fn);
}
