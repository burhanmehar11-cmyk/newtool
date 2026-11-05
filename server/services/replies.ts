import "server-only";
import { brand } from "@/config/brand";
import { configuredSiteUrl } from "@/server/env";
import { emitWebhook } from "@/server/services/webhooks";
import { z } from "zod";
import { hasReadScope } from "@/lib/gmail/oauth";
import { classifyReply, type ReplyKind } from "@/lib/replies/classify";
import { parseMessage } from "@/lib/replies/gmail-thread";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { addSuppression } from "@/server/campaign-store";
import { withService, withUser } from "@/server/db";
import { getThread } from "@/server/gmail/google";
import { markMailbox } from "@/server/mailbox-store";
import { inboxThreads, knownMessageIds, mailboxesForSync, markSynced, recordInbound, replyCounts, setThreadState, threadDetail, threadsForMailbox, type MailboxForSync } from "@/server/replies-store";
import { accessTokenFor } from "@/server/services/mailboxes";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

/** How often a mailbox is checked for replies at most. */
export const SYNC_EVERY_MS = 4 * 60_000;

export type SyncSummary = { checked: number; newReplies: number; skipped: string[] };

async function syncMailbox(box: MailboxForSync, summary: SyncSummary) {
  const token = await accessTokenFor(box.id);
  if (!token.ok) {
    summary.skipped.push(`${box.email}: ${token.message}`);
    return;
  }
  const threads = await svc((q) => threadsForMailbox(q, box.id));
  for (const t of threads) {
    const r = await getThread(token.token, t.provider_thread_id);
    if (!r.ok) {
      if (r.code === "permission" || r.code === "auth") {
        await svc((q) => markMailbox(q, box.id, { lastError: r.message }));
        summary.skipped.push(`${box.email}: ${r.message}`);
        return;
      }
      continue;
    }
    summary.checked++;
    const known = await svc((q) => knownMessageIds(q, t.id));
    for (const raw of r.messages) {
      const m = parseMessage(raw);
      if (!m || known.has(m.id)) continue;
      if (m.fromEmail === box.email) {
        // Something the sender wrote in Gmail themselves: keep it for context.
        await svc((q) =>
          q.query(
            `insert into public.messages (workspace_id, thread_id, direction, provider_message_id, from_addr, to_addr, subject, body_text, occurred_at)
             values ($1, $2, 'outbound', $3, $4, $5, $6, $7, $8) on conflict (workspace_id, provider_message_id) do nothing`,
            [t.workspace_id, t.id, m.id, m.from.slice(0, 300), m.to.slice(0, 300), m.subject.slice(0, 300), m.text, m.date],
          ),
        );
        continue;
      }
      const c = classifyReply(m);
      const added = await svc((q) =>
        recordInbound(q, { ws: t.workspace_id, threadId: t.id, messageId: m.id, from: m.from, to: m.to, subject: m.subject, text: m.text, at: m.date, kind: c.kind, classificationSource: t.classification_source, leadId: t.lead_id, campaignId: t.campaign_id }),
      );
      if (!added) continue;
      summary.newReplies++;
      await emitWebhook(t.workspace_id, "reply.received", m.id, {
        thread_id: t.id,
        campaign_id: t.campaign_id,
        lead_id: t.lead_id,
        from: m.from,
        subject: m.subject,
        text: m.text.slice(0, 2000),
        label: c.kind,
        received_at: m.date.toISOString(),
        url: `${configuredSiteUrl() ?? brand.siteUrl}/app/inbox/${t.id}`,
      });
      // Opt-outs and bounces go on the do-not-contact list for the address we emailed.
      if (c.kind === "bounce" || c.stopRequested) {
        await svc(async (q) => {
          const to = (await q.query<{ to_addr: string }>("select to_addr from public.messages where thread_id = $1 and direction = 'outbound' order by occurred_at limit 1", [t.id])).rows[0]?.to_addr;
          if (to) await addSuppression(q, t.workspace_id, null, to.toLowerCase(), "email", c.kind === "bounce" ? "bounce" : "unsubscribe");
          if (c.kind === "bounce" && t.campaign_id && t.lead_id) {
            await q.query("update public.enrollments set state = 'stopped', reason = 'Bounced: the address rejected the email' where campaign_id = $1 and lead_id = $2", [t.campaign_id, t.lead_id]);
          }
        });
      }
    }
  }
  await svc((q) => markSynced(q, box.id));
}

/** Checks this workspace's mailboxes that have reply tracking on. Throttled per mailbox unless forced. */
export async function syncWorkspaceReplies(workspaceId: string, force = false): Promise<SyncSummary> {
  const summary: SyncSummary = { checked: 0, newReplies: 0, skipped: [] };
  const boxes = await svc((q) => mailboxesForSync(q, workspaceId));
  for (const box of boxes) {
    if (!hasReadScope(box.scopes)) continue;
    if (!force && box.last_synced_at && Date.now() - new Date(box.last_synced_at).getTime() < SYNC_EVERY_MS) continue;
    await syncMailbox(box, summary);
  }
  return summary;
}

export async function checkRepliesNow(): Promise<{ ok: true; newReplies: number; note: string | null } | { ok: false; error: string }> {
  const { workspace } = await requireWorkspace("/app/inbox");
  const boxes = await svc((q) => mailboxesForSync(q, workspace.id));
  if (!boxes.some((b) => hasReadScope(b.scopes))) return { ok: false, error: "Turn on reply tracking for a mailbox first (Mailboxes page)." };
  const r = await syncWorkspaceReplies(workspace.id, true);
  return { ok: true, newReplies: r.newReplies, note: r.skipped[0] ?? null };
}

export async function getInbox(filter: string) {
  const { user, workspace } = await requireWorkspace("/app/inbox");
  const f = (["interested", "not_interested", "out_of_office", "bounce", "unclassified"].includes(filter) ? filter : "all") as ReplyKind | "all";
  const [threads, counts, boxes] = await Promise.all([
    asQ(user.id, (q) => inboxThreads(q, workspace.id, f)),
    asQ(user.id, (q) => replyCounts(q, workspace.id)),
    svc((q) => mailboxesForSync(q, workspace.id)),
  ]);
  return { threads, counts, filter: f, trackingOn: boxes.some((b) => hasReadScope(b.scopes)) };
}

export async function getThreadDetail(id: string) {
  const { user } = await requireWorkspace(`/app/inbox/${id}`);
  if (!z.string().uuid().safeParse(id).success) return null;
  // No side effects here: pages can be prefetched. The open page marks it read (markThreadRead).
  return asQ(user.id, (q) => threadDetail(q, id));
}

const kinds = z.enum(["interested", "not_interested", "out_of_office", "bounce", "unclassified"]);

export async function labelThread(id: string, kind: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await requireWorkspace("/app/inbox");
  const k = kinds.safeParse(kind);
  if (!z.string().uuid().safeParse(id).success || !k.success) return { ok: false, error: "Not found." };
  await asQ(user.id, (q) => setThreadState(q, id, { classification: k.data }));
  return { ok: true };
}

export async function markThreadRead(id: string) {
  const { user } = await requireWorkspace("/app/inbox");
  if (!z.string().uuid().safeParse(id).success) return;
  await asQ(user.id, (q) => setThreadState(q, id, { unread: false }));
}
