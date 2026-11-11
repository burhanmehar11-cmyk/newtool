import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminEmails } from "@/lib/admin";
import { findTemplate } from "@/lib/announcements";
import { continueAnnouncement, getAnnouncementsData, sendAnnouncementTest, startAnnouncement, stopAnnouncement, type Actor } from "@/server/services/announcements";

/**
 * Private admin API for announcements, so the owner (or their assistant) can
 * test and send them without the admin panel. Only announcements: nothing
 * else in Locenti is reachable with this token.
 *
 *   Authorization: Bearer <ADMIN_API_TOKEN>     (set in Vercel, 32+ characters)
 *
 *   GET                                   → templates, recipients, sender, history
 *   POST {action:"test", template | subject+body}          → test to the owner
 *   POST {action:"send", template | subject+body, confirm:true} → starts and sends for ~45 s
 *   POST {action:"continue", id}          → sends the next batch
 *   POST {action:"stop", id}              → stops a send
 */

export const maxDuration = 60;

function authorized(request: NextRequest): Actor | null {
  const expected = process.env.ADMIN_API_TOKEN?.trim() ?? "";
  const owner = adminEmails()[0];
  if (expected.length < 32 || !owner) return null;
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/)?.[1]?.trim() ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? { email: owner } : null;
}

const denied = () => NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });

export async function GET(request: NextRequest) {
  const actor = authorized(request);
  if (!actor) return denied();
  const d = await getAnnouncementsData(actor);
  return NextResponse.json(
    {
      ok: true,
      ready: d.ready,
      recipients: d.recipients,
      optOuts: d.optOuts,
      sender: { channel: d.channel, from: d.from, replyTo: d.replyTo },
      templates: d.templates.map((t) => ({ id: t.id, label: t.label, subject: t.subject })),
      history: d.history,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const draft = z.object({ template: z.string().max(40).optional(), subject: z.string().max(200).optional(), body: z.string().max(20000).optional() });
const bodySchema = z.discriminatedUnion("action", [
  draft.extend({ action: z.literal("test") }),
  draft.extend({ action: z.literal("send"), confirm: z.literal(true) }),
  z.object({ action: z.literal("continue"), id: z.string().uuid() }),
  z.object({ action: z.literal("stop"), id: z.string().uuid() }),
]);

/** A template by id, with subject or body overridden if given. */
function resolveDraft(d: z.infer<typeof draft>) {
  const t = findTemplate(d.template);
  return { template: t?.id ?? null, subject: d.subject ?? t?.subject ?? "", body: d.body ?? t?.body ?? "" };
}

export async function POST(request: NextRequest) {
  const actor = authorized(request);
  if (!actor) return denied();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: `Invalid request: ${parsed.error.issues[0]?.message ?? "check the body"}` }, { status: 400 });
  const b = parsed.data;

  if (b.action === "test") return NextResponse.json(await sendAnnouncementTest(resolveDraft(b), actor));
  if (b.action === "stop") return NextResponse.json(await stopAnnouncement(b.id, actor));
  if (b.action === "continue") return NextResponse.json(await continueAnnouncement(b.id, actor));

  // send: start, then keep sending batches for ~45 s; the caller continues with the id if there's more.
  const started = await startAnnouncement({ ...resolveDraft(b), confirm: true }, actor);
  if (!started.ok) return NextResponse.json(started, { status: 400 });
  const t0 = Date.now();
  let sent = 0;
  let failed = 0;
  let last: Awaited<ReturnType<typeof continueAnnouncement>> | null = null;
  while (Date.now() - t0 < 45_000) {
    last = await continueAnnouncement(started.id, actor);
    if (!last.ok) break;
    sent += last.sent;
    failed += last.failed;
    if (last.done || last.note || (last.sent === 0 && last.failed === 0)) break;
  }
  return NextResponse.json({
    ok: true,
    id: started.id,
    total: started.total,
    sent,
    failed,
    remaining: last && last.ok ? last.remaining : null,
    done: !!(last && last.ok && last.done),
    note: last && last.ok ? last.note : last ? last.error : null,
  });
}
