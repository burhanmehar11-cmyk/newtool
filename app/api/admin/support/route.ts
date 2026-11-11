import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminApiActor } from "@/server/admin-api-auth";
import { ticketRef } from "@/server/support-store";
import { adminReplyToTicket, adminUpdateTicket, getSupportInbox, supportTicketIdByRef } from "@/server/services/support";

/**
 * Private admin API for support requests (same ADMIN_API_TOKEN as
 * announcements), so the owner's assistant can handle a ticket by number.
 *
 *   GET ?status=needs_reply|waiting|resolved|all   → counters and the queue
 *   GET ?ref=LOC-1042                              → the conversation and the customer
 *   POST {action:"reply", ref, body}               → reply (emailed + in-app)
 *   POST {action:"note", ref, body}                → internal note
 *   POST {action:"status", ref, status}            → needs_reply | waiting | resolved
 *   POST {action:"priority", ref, priority}        → normal | urgent
 */

const denied = () => NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });

export async function GET(request: NextRequest) {
  const actor = adminApiActor(request);
  if (!actor) return denied();
  const sp = request.nextUrl.searchParams;
  const ref = sp.get("ref");
  if (ref) {
    const id = await supportTicketIdByRef(ref, actor);
    if (!id) return NextResponse.json({ ok: false, error: `No request ${ref}.` }, { status: 404 });
    const d = await getSupportInbox({ tab: "all", ticket: id }, actor);
    if (!d.selected) return NextResponse.json({ ok: false, error: `No request ${ref}.` }, { status: 404 });
    const t = d.selected.ticket;
    return NextResponse.json({
      ok: true,
      ticket: { ref: ticketRef(t), subject: t.subject, email: t.email, topic: t.topic, priority: t.priority, status: t.status, assignedTo: t.assigned_to, createdAt: t.created_at, overdue: t.overdue },
      messages: d.selected.messages.map((m) => ({ from: m.internal ? `note:${m.author_email}` : m.author === "customer" ? t.email : "team", body: m.body, at: m.created_at })),
      customer: d.customer,
    });
  }
  const d = await getSupportInbox({ tab: sp.get("status") ?? "needs_reply" }, actor);
  return NextResponse.json({
    ok: true,
    ready: d.ready,
    counts: d.counts,
    queue: d.list.map((t) => ({ ref: ticketRef(t), subject: t.subject, email: t.email, status: t.status, priority: t.priority, overdue: t.overdue, updatedAt: t.updated_at, preview: t.preview })),
  });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), ref: z.string().max(40), body: z.string().max(10000) }),
  z.object({ action: z.literal("note"), ref: z.string().max(40), body: z.string().max(10000) }),
  z.object({ action: z.literal("status"), ref: z.string().max(40), status: z.enum(["needs_reply", "waiting", "resolved"]) }),
  z.object({ action: z.literal("priority"), ref: z.string().max(40), priority: z.enum(["normal", "urgent"]) }),
]);

export async function POST(request: NextRequest) {
  const actor = adminApiActor(request);
  if (!actor) return denied();
  const p = schema.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: `Invalid request: ${p.error.issues[0]?.message ?? "check the body"}` }, { status: 400 });
  const id = await supportTicketIdByRef(p.data.ref, actor);
  if (!id) return NextResponse.json({ ok: false, error: `No request ${p.data.ref}.` }, { status: 404 });
  const b = p.data;
  if (b.action === "reply" || b.action === "note") return NextResponse.json(await adminReplyToTicket(id, b.body, b.action === "note", actor));
  if (b.action === "status") return NextResponse.json(await adminUpdateTicket(id, { status: b.status }, actor));
  return NextResponse.json(await adminUpdateTicket(id, { priority: b.priority }, actor));
}
