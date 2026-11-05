import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { listLeads, saveGoogleLeads, savedPlaceIds } from "@/server/discovery-store";
import { TAKE_SLOT_SQL } from "@/server/providers/google-places";
import { as, createTestDb, createUser } from "./harness";

const A = "00000000-0000-4000-8000-0000000000a2";
const B = "00000000-0000-4000-8000-0000000000b2";
let db: PGlite;
let q: Q;
let wsA: string;

beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
  await createUser(db, A, "a@agency.example");
  await createUser(db, B, "b@agency.example");
  wsA = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency A') as id")).rows[0].id);
  await as(db, B, async () => db.query("select public.create_workspace('Agency B')"));
}, 60_000);

describe("Google Maps leads store no Google content", () => {
  it("keeps the place id and website; the name is the domain until research", async () => {
    const r = await as(db, A, () =>
      saveGoogleLeads(
        q,
        wsA,
        A,
        [
          { placeId: "ChIJ_fictional_place_0001", website: "https://www.sample-dental.example/" },
          { placeId: "bad id", website: "https://x.example/" },
          { placeId: "ChIJ_fictional_place_0002", website: "not a url" },
        ],
        "dental",
      ),
    );
    expect(r).toEqual({ added: 1, skipped: 2 });
    const row = (
      await as(db, A, () => db.query<Record<string, unknown>>("select provider, provider_ref, name, address, phone, rating, review_count, category, website, domain_normalized from public.businesses"))
    ).rows;
    expect(row).toEqual([
      {
        provider: "google_places",
        provider_ref: "ChIJ_fictional_place_0001",
        name: "sample-dental.example",
        address: null,
        phone: null,
        rating: null,
        review_count: null,
        category: null,
        website: "https://www.sample-dental.example/",
        domain_normalized: "sample-dental.example",
      },
    ]);
    const leads = await as(db, A, () => listLeads(q, wsA));
    expect(leads[0]).toMatchObject({ provider: "google_places", provider_ref: "ChIJ_fictional_place_0001", source_url: null });
  });

  it("doesn't save the same place twice and reports which are already saved", async () => {
    const r = await as(db, A, () => saveGoogleLeads(q, wsA, A, [{ placeId: "ChIJ_fictional_place_0001", website: "https://sample-dental.example/" }], null));
    expect(r).toEqual({ added: 0, skipped: 1 });
    expect(await as(db, A, () => savedPlaceIds(q, wsA, ["ChIJ_fictional_place_0001", "ChIJ_other_place_00009"]))).toEqual(["ChIJ_fictional_place_0001"]);
  });

  it("other workspaces can't see or save into it", async () => {
    expect(await as(db, B, () => savedPlaceIds(q, wsA, ["ChIJ_fictional_place_0001"]))).toEqual([]);
    await expect(as(db, B, () => saveGoogleLeads(q, wsA, B, [{ placeId: "ChIJ_fictional_place_0009", website: "https://y.example/" }], null))).rejects.toThrow();
  });
});

describe("global daily Google call limit", () => {
  it("hands out slots until the limit, then refuses", async () => {
    const take = async (limit: number) => (await db.query(TAKE_SLOT_SQL, ["google_places_test", limit])).rows.length;
    expect([await take(3), await take(3), await take(3), await take(3), await take(3)]).toEqual([1, 1, 1, 0, 0]);
    expect(await take(5)).toBe(1); // raising the limit frees more
  });

  it("is invisible to signed-in users", async () => {
    await expect(as(db, A, () => db.query("select * from app.provider_daily_calls"))).rejects.toThrow(/permission denied/);
  });
});
