import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Runs the real migrations in PGlite (Postgres compiled to WASM) with a
 * minimal shim of what Supabase provides: the auth schema, auth.uid(), and
 * the anon / authenticated / service_role roles. Lets us test RLS and the
 * SQL functions without a Supabase project.
 */
const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(SHIM);
  const dir = join(process.cwd(), "database/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

export async function createUser(db: PGlite, id: string, email: string) {
  await db.exec("reset role");
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}

/** Run queries as an authenticated user (or anon when id is null), as PostgREST would. */
export async function as<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
