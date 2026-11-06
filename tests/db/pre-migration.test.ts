import { describe, expect, it } from "vitest";
import type { Q } from "@/server/auth-store";
import { DEFAULT_SCHEDULE } from "@/lib/campaigns/schedule";
import { createCampaign, getCampaign, listCampaigns, updateLiveSettings } from "@/server/campaign-store";
import { as, createTestDb, createUser } from "./harness";

/** A deploy can reach the database before the owner runs the newest migration: campaign pages must still load. */
describe("before migration 0015", () => {
  it("lists, opens and edits campaigns without the deleted_at column", async () => {
    const db = await createTestDb();
    const q = db as unknown as Q;
    await db.query("alter table public.campaigns drop column deleted_at");
    const U = "00000000-0000-4000-8000-00000000a015";
    await createUser(db, U, "early@agency.example");
    const ws = await as(db, U, async () => (await db.query<{ id: string }>("select public.create_workspace('Early') as id")).rows[0].id);
    const id = await as(db, U, () => createCampaign(q, ws, U, { name: "Early bird", schedule: DEFAULT_SCHEDULE, mailboxId: null, leadIds: [] }));
    expect((await as(db, U, () => listCampaigns(q, ws))).map((c) => c.name)).toEqual(["Early bird"]);
    expect(await as(db, U, () => getCampaign(q, id))).toMatchObject({ name: "Early bird" });
    await db.query("update public.campaigns set status = 'paused' where id = $1", [id]);
    expect(await as(db, U, () => updateLiveSettings(q, id, { name: "Renamed", schedule: DEFAULT_SCHEDULE }))).toBe(true);
  }, 60_000);
});
