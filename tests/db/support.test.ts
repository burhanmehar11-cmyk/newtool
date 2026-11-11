import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { as, createTestDb, createUser } from "./harness";

/** Support: privacy (own requests only, no internal notes), queue and counters, emails and notifications both ways. */

const h = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.com";
  process.env.ADMIN_EMAILS = "owner@locenti.example";
  return { db: null as unknown as PGlite, as: null as unknown as typeof import("./harness").as, user: { id: "", email: "" }, ws: null as null | { id: string; name: string; role: string }, send: vi.fn() };
});
vi.mock("@/server/db", () => ({
  withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db),
  withUser: (userId: string, fn: (q: unknown) => Promise<unknown>) => h.as(h.db, userId, () => fn(h.db)),
}));
vi.mock("@/server/auth", () => ({
  requireUser: async () => ({ id: h.user.id, email: h.user.email, sessionId: "s" }),
  requireWorkspace: async () => ({ user: { id: h.user.id, email: h.user.email, sessionId: "s" }, workspace: h.ws }),
  getActiveWorkspace: async () => h.ws,
}));
vi.mock("@/server/services/admin", () => ({ requireAdmin: async () => ({ id: "admin", email: "owner@locenti.example", sessionId: "s" }) }));
vi.mock("@/server/email", () => ({ sendEmail: (...a: unknown[]) => h.send(...a) }));

const support = await import("@/server/services/support");
const store = await import("@/server/support-store");

const ANN = "00000000-0000-4000-8000-0000000f0001";
const BOB = "00000000-0000-4000-8000-0000000f0002";
let wsAnn: string;
const asUser = (id: string, email: string) => {
  h.user = { id, email };
};

beforeAll(async () => {
  h.db = await createTestDb();
  h.as = as;
  await createUser(h.db, ANN, "ann@agency.example");
  await createUser(h.db, BOB, "bob@studio.example");
  wsAnn = await as(h.db, ANN, async () => (await h.db.query<{ id: string }>("select public.create_workspace('Ann Agency') as id")).rows[0].id);
  h.ws = { id: wsAnn, name: "Ann Agency", role: "owner" };
}, 60_000);

describe("support", () => {
  let ticket: string;

  it("lets a person open a request, and emails the owner", async () => {
    asUser(ANN, "ann@agency.example");
    h.send.mockReset().mockResolvedValue(undefined);
    const r = await support.openSupportRequest({ subject: "Mailbox needs reconnecting", topic: "mailbox", urgent: true, body: "It keeps asking me to reconnect." });
    if (!r.ok) throw new Error(r.error);
    ticket = r.id;
    expect(r.ref).toBe("LOC-1001");
    // First the person's confirmation, with the ticket number…
    const [toUser, subjectUser, textUser] = h.send.mock.calls[0];
    expect(toUser).toBe("ann@agency.example");
    expect(subjectUser).toBe("We've received your request [LOC-1001]");
    expect(textUser).toContain("Ticket: LOC-1001");
    expect(textUser).toContain(`https://locenti.com/app/support/${ticket}`);
    expect(textUser).toContain("Happy Sending,\nThe Locenti Team");
    // …then the alert to the owner.
    const [to, subject, text] = h.send.mock.calls[1];
    expect(to).toBe("owner@locenti.example");
    expect(subject).toBe("[LOC-1001, urgent] Mailbox needs reconnecting");
    expect(text).toContain(`https://locenti.com/admin?tab=support&t=${ticket}`);
    expect((await support.getMySupport()).tickets.map((t) => t.subject)).toEqual(["Mailbox needs reconnecting"]);
  });

  it("shows up in the queue as urgent and needing a reply", async () => {
    const d = await support.getSupportInbox({ ticket });
    expect(d.counts).toEqual({ needsReply: 1, urgent: 1, overdue: 0 });
    expect(d.list.map((t) => t.id)).toEqual([ticket]);
    expect(d.customer).toMatchObject({ email: "ann@agency.example", workspace: { name: "Ann Agency", plan: "trial" } });
    expect(d.customer?.workspace?.trialDaysLeft).toBeGreaterThan(0);
    // Filters
    expect((await support.getSupportInbox({ topic: "billing" })).list).toEqual([]);
    expect((await support.getSupportInbox({ search: "ann@" })).list).toHaveLength(1);
    expect((await support.getSupportInbox({ search: "LOC-1001" })).list.map((t) => t.id)).toEqual([ticket]);
    expect((await support.getSupportInbox({ search: "1001" })).list).toHaveLength(1);
    expect(await support.supportBadge()).toEqual({ needsReply: 1, urgent: 1, overdue: 0 });
  });

  it("keeps internal notes from the person; a reply notifies and emails them, and waits on them", async () => {
    h.send.mockReset().mockResolvedValue(undefined);
    expect(await support.adminReplyToTicket(ticket, "Checking their Google project settings.", true)).toEqual({ ok: true });
    expect(h.send).not.toHaveBeenCalled(); // notes aren't sent
    expect(await support.adminReplyToTicket(ticket, "Your Google app was in Testing mode; publish it and reconnect once.", false)).toEqual({ ok: true });
    const [to, subject, text] = h.send.mock.calls[0];
    expect(to).toBe("ann@agency.example");
    expect(subject).toBe("Re: [LOC-1001] Mailbox needs reconnecting");
    expect(text).toContain("Happy Sending,\nThe Locenti Team");
    const mine = await support.getMyTicketDetail(ticket);
    expect(mine?.ticket.status).toBe("waiting");
    expect(mine?.messages.map((m) => m.author)).toEqual(["customer", "admin"]); // the note isn't visible to them
    const n = await as(h.db, ANN, () => h.db.query<{ title: string; href: string }>("select title, href from public.notifications where user_id = $1", [ANN]));
    expect(n.rows).toEqual([{ title: "We replied to LOC-1001", href: `/app/support/${ticket}` }]);
    const d = await support.getSupportInbox({ tab: "mine" });
    expect(d.list.map((t) => t.assigned_to)).toEqual(["owner@locenti.example"]); // replying assigns it
  });

  it("reopens when the person replies, and resolves", async () => {
    asUser(ANN, "ann@agency.example");
    expect(await support.replyToMyTicket(ticket, "Done, works now. Thanks!")).toEqual({ ok: true });
    expect((await support.getMyTicketDetail(ticket))?.ticket.status).toBe("needs_reply");
    expect(await support.adminUpdateTicket(ticket, { status: "resolved", priority: "normal" })).toEqual({ ok: true });
    expect((await support.getSupportInbox({ tab: "resolved" })).list.map((t) => t.id)).toEqual([ticket]);
  });

  it("keeps everyone else out", async () => {
    asUser(BOB, "bob@studio.example");
    expect(await support.getMyTicketDetail(ticket)).toBeNull();
    expect((await support.getMySupport()).tickets).toEqual([]);
    expect(await support.replyToMyTicket(ticket, "I shouldn't be able to do this")).toMatchObject({ ok: false });
    // Not even directly: no internal notes, no posing as support, no tickets for others.
    const q = h.db as unknown as Q;
    await expect(as(h.db, ANN, () => h.db.query("insert into public.support_messages (ticket_id, author, body) values ($1, 'admin', 'fake answer')", [ticket]))).rejects.toThrow();
    await expect(as(h.db, ANN, () => h.db.query("insert into public.support_tickets (user_id, email, subject) values ($1, 'x@x.example', 'for bob')", [BOB]))).rejects.toThrow();
    const visible = await as(h.db, ANN, () => store.getMyTicket(q, ticket));
    expect(visible?.messages.some((m) => m.internal)).toBe(false);
  });

  it("flags requests waiting longer than the reply target", async () => {
    asUser(BOB, "bob@studio.example");
    h.ws = null;
    const r = await support.openSupportRequest({ subject: "Question about plans", topic: "billing", body: "When do prices come out?" });
    if (!r.ok) throw new Error(r.error);
    await h.db.query("update public.support_tickets set last_customer_at = now() - interval '30 hours' where id = $1", [r.id]);
    const d = await support.getSupportInbox({});
    expect(d.counts.overdue).toBe(1);
    expect(d.list[0]).toMatchObject({ id: r.id, overdue: true });
  });

  it("lets the owner start a conversation (Message)", async () => {
    h.send.mockReset().mockResolvedValue(undefined);
    const r = await support.adminStartConversation({ userId: ANN, subject: "Quick check-in", body: "How is your first campaign going?" });
    if (!r.ok) throw new Error(r.error);
    expect(h.send.mock.calls[0][0]).toBe("ann@agency.example");
    asUser(ANN, "ann@agency.example");
    expect((await support.getMySupport()).tickets.find((t) => t.id === r.id)).toMatchObject({ channel: "admin", status: "waiting" });
  });
});
