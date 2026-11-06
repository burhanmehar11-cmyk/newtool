import { describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./harness";

const h = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));

describe("migration check", () => {
  it("finds nothing missing on a fully migrated database, in one query", async () => {
    h.db = await createTestDb();
    const spy = vi.spyOn(h.db, "query");
    const { missingMigrations } = await import("@/server/schema-check");
    expect(await missingMigrations()).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("names a missing migration", async () => {
    vi.resetModules();
    await h.db.query("alter table app.site_visits rename to site_visits_gone");
    const { missingMigrations } = await import("@/server/schema-check");
    expect(await missingMigrations()).toEqual(["0011_admin.sql"]);
  });
});
