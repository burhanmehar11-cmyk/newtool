import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser } from "./harness";

const U = "00000000-0000-4000-8000-00000000c5c5";
const h = vi.hoisted(() => ({ db: null as unknown as PGlite, as: null as unknown as typeof import("./harness").as, ws: "", page: vi.fn(), find: vi.fn() }));
vi.mock("@/server/db", () => ({
  withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db),
  withUser: (userId: string, fn: (q: unknown) => Promise<unknown>) => h.as(h.db, userId, () => fn(h.db)),
}));
vi.mock("@/server/auth", async (orig) => ({
  ...(await orig<typeof import("@/server/auth")>()),
  requireWorkspace: async () => ({ user: { id: "00000000-0000-4000-8000-00000000c5c5", email: "io@agency.example", sessionId: "s" }, workspace: { id: h.ws, name: "IO", role: "owner" } }),
}));
vi.mock("@/server/providers/google-places", async (orig) => ({ ...(await orig<typeof import("@/server/providers/google-places")>()), searchPage: (...a: unknown[]) => h.page(...a) }));
vi.mock("@/server/research/find-emails", () => ({ findEmailsOnWebsite: (...a: unknown[]) => h.find(...a) }));
// The free domain check is tested on its own (tests/deliverable.test.ts); here it lets every address through.
vi.mock("@/server/research/email-check", () => ({ deliverableEmails: async <T,>(x: T[]) => x }));

const { importLeadsCsv, exportLeadsCsv } = await import("@/server/services/leads-io");
const { runGoogleSearchAs } = await import("@/server/services/discovery");
const { splitCsv } = await import("@/lib/csv");

let db: PGlite;
const place = (n: number, website: string | null) => ({ placeId: `ChIJ${String(n).padStart(23, "x")}`, name: `Biz ${n}`, address: "1 St", category: "Dentist", phone: null, website, rating: 4.5, ratingCount: 10, status: "OPERATIONAL", mapsUri: null });
const committed = async () => Number((await db.query<{ n: number }>("select app.committed_units($1, 'discovery') as n", [h.ws])).rows[0].n);

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  h.as = as;
  await createUser(db, U, "io@agency.example");
  h.ws = await as(db, U, async () => (await db.query<{ id: string }>("select public.create_workspace('IO Co') as id")).rows[0].id);
}, 60_000);

beforeEach(() => {
  h.page.mockReset();
  h.find.mockReset();
});

describe("CSV import and export", () => {
  it("imports leads, skips duplicates, and exports them back", async () => {
    const csv = "name,website,email,type,city\nRiverbend Dental,https://riverbend.example,info@riverbend.example,Dentist,Austin\nOak Hill,oakhill.example,,Dentist,Austin\nDup,https://www.riverbend.example,,,\n";
    const r = await importLeadsCsv(csv);
    expect(r).toMatchObject({ ok: true, added: 2, skipped: 1 });
    expect((await importLeadsCsv(csv)) as { added: number }).toMatchObject({ added: 0, skipped: 3 });
    const out = await exportLeadsCsv();
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const table = splitCsv(out.csv.slice(1));
    expect(table[0]).toEqual(["Business", "Website", "Emails", "Business type", "City", "Source", "Google Maps link", "Research", "Fit", "Notes", "Saved"]);
    expect(table.slice(1).map((r) => [r[0], r[1], r[2], r[5]])).toEqual(
      expect.arrayContaining([
        ["Riverbend Dental", "https://riverbend.example", "info@riverbend.example", "Imported"],
        ["Oak Hill", "https://oakhill.example", "", "Imported"],
      ]),
    );
  });

  it("rejects files without the needed columns", async () => {
    expect(await importLeadsCsv("phone\n123")).toMatchObject({ ok: false });
  });
});

describe("Google Maps search returns only businesses with an email", () => {
  it("keeps businesses with an email, fetches more pages until enough, and charges only for those", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "test";
    const page1 = Array.from({ length: 20 }, (_, i) => place(i, i % 4 === 0 ? null : `https://biz${i}.example`));
    const page2 = Array.from({ length: 20 }, (_, i) => place(100 + i, `https://biz${100 + i}.example`));
    h.page.mockResolvedValueOnce({ ok: true, value: { places: page1, nextPageToken: "p2" } }).mockResolvedValueOnce({ ok: true, value: { places: page2, nextPageToken: null } });
    // Every other website shows an email.
    h.find.mockImplementation(async (site: string) => {
      const n = Number(/biz(\d+)/.exec(site)![1]);
      return n % 2 === 1 ? { status: "found", emails: [{ email: `info@biz${n}.example`, kind: "role", url: site }], siteName: `Biz ${n} Site`, note: "" } : { status: "none", emails: [], siteName: null, note: "" };
    });
    const before = await committed();
    const r = await runGoogleSearchAs({ user: { id: U }, workspace: { id: h.ws, name: "IO", role: "owner" } }, { businessType: "dentists", place: "Austin", country: "US", maxResults: 20, website: "any", minRating: 0 });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(h.page).toHaveBeenCalledTimes(2); // page 1 gave 10 with email, so it fetched page 2
    expect(r.results).toHaveLength(20);
    expect(r.results.every((x) => x.emails.length > 0)).toBe(true);
    expect(r.results[0]).toMatchObject({ siteName: expect.stringMatching(/Site$/) });
    expect(r).toMatchObject({ requests: 2, scanned: 40, noWebsite: 5 });
    expect((await committed()) - before).toBe(20); // charged only for businesses with an email
  });

  it("charges nothing when no business shows an email", async () => {
    h.page.mockResolvedValueOnce({ ok: true, value: { places: [place(500, "https://none.example")], nextPageToken: null } });
    h.find.mockResolvedValue({ status: "none", emails: [], siteName: null, note: "" });
    const before = await committed();
    const r = await runGoogleSearchAs({ user: { id: U }, workspace: { id: h.ws, name: "IO", role: "owner" } }, { businessType: "dentists", place: "Austin", country: "US", maxResults: 20, website: "any", minRating: 0 });
    expect(r).toMatchObject({ ok: true, results: [], noEmail: 1 });
    expect(await committed()).toBe(before);
  });
});
