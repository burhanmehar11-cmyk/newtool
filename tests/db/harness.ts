import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { USER_SCOPE_SQL } from "@/server/db-sql";

/**
 * Runs the real migrations (including 0000_auth.sql) in PGlite, Postgres
 * compiled to WASM. Queries are scoped to a user with exactly the same SQL
 * the server uses in withUser(), so RLS is tested as it runs in production.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = process.env.TEST_DATABASE_URL ? await realPostgres(process.env.TEST_DATABASE_URL) : new PGlite();
  const dir = join(process.cwd(), "database/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

/**
 * With TEST_DATABASE_URL (a superuser connection, as in CI's Postgres
 * service), each test file gets its own fresh database on a real server, so
 * the same tests also cover real Postgres behaviour. Only the two PGlite
 * methods the tests use are provided.
 */
async function realPostgres(url: string): Promise<PGlite> {
  const { Client } = (await import("pg")).default;
  const name = `locenti_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new Client({ connectionString: url });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const u = new URL(url);
  u.pathname = `/${name}`;
  const client = new Client({ connectionString: u.toString() });
  await client.connect();
  const db = {
    query: (sql: string, params?: unknown[]) => client.query(sql, params as unknown[]),
    exec: (sql: string) => client.query(sql),
  } as unknown as PGlite;
  realUrls.set(db, u.toString());
  return db;
}

const realUrls = new WeakMap<PGlite, string>();

/** The connection URL of a real-Postgres test database (null on PGlite), for tests that need several connections. */
export const realUrlOf = (db: PGlite) => realUrls.get(db) ?? null;

export async function createUser(db: PGlite, id: string, email: string) {
  await db.query("insert into auth.users (id, auth_subject, email) values ($1, $2, $3)", [id, `google:${id.slice(-6)}`, email]);
}

// PGlite has one connection; production uses one pooled connection per
// transaction. Serialise scopes so concurrent calls don't interleave.
let queue: Promise<unknown> = Promise.resolve();

/** Run queries as a signed-in user, or as anon when id is null. */
export function as<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  const run = queue.then(() => scoped(db, userId, fn));
  queue = run.catch(() => undefined);
  return run;
}

async function scoped<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    if (userId) {
      await db.exec(USER_SCOPE_SQL.role);
      await db.query(USER_SCOPE_SQL.setUser, [userId]);
    } else {
      await db.exec("set local role anon");
    }
    const r = await fn();
    await db.exec("commit");
    return r;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
