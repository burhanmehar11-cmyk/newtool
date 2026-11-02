import "server-only";
import pg from "pg";
import { databaseUrl } from "@/server/env";
import { USER_SCOPE_SQL } from "@/server/db-sql";

export type Queryable = Pick<pg.PoolClient, "query">;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  const url = databaseUrl();
  if (!url) throw new Error("Database is not configured");
  // Small pool: serverless functions each hold their own. Works with poolers in
  // transaction mode because all per-user settings are transaction-local.
  pool ??= new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  return pool;
}

async function transaction<T>(scope: (c: pg.PoolClient) => Promise<void>, fn: (q: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
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

/** Server-only bookkeeping (users, sessions). Never pass user input as SQL. */
export function withService<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return transaction(async () => undefined, fn);
}
