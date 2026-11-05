import "server-only";
import { randomUUID } from "node:crypto";
import { brand } from "@/config/brand";
import { inSendingWindow } from "@/lib/campaigns/schedule";
import { signUnsubscribe, unsubscribeHeaders, unsubscribeUrl, withFooter } from "@/lib/campaigns/compose";
import { followUpSubject, renderFollowUp } from "@/lib/campaigns/followups";
import { buildMessage, toGmailRaw } from "@/lib/gmail/mime";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { configuredSiteUrl, sessionSecret } from "@/server/env";
import { sendRaw } from "@/server/gmail/google";
import { accessTokenFor } from "@/server/services/mailboxes";
import { claimDispatch, completeFinished, isSuppressedEmail, mailboxUsage, nextDue, pauseCampaign, recordAccepted, recordFailure, runningCampaigns } from "@/server/dispatch-store";
import { markMailbox } from "@/server/mailbox-store";
import { emitWebhook } from "@/server/services/webhooks";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));

/** At least this long between two emails from the same mailbox. */
export const MIN_GAP_MS = 3 * 60_000;

export type DispatchSummary = { sent: number; skipped: string[]; failed: number };

/**
 * One sending pass. Called by the scheduler (/api/cron/dispatch, every few
 * minutes) or by "Send due emails now". Sends at most one email per mailbox
 * per pass, only inside each campaign's sending window, within the mailbox's
 * daily limit, at least MIN_GAP_MS apart, and never to a suppressed address.
 */
/** Completes a campaign with nothing left to send, and tells webhooks once. */
async function finish(c: { id: string; workspace_id: string }) {
  if (await svc((q) => completeFinished(q, c.id))) {
    const name = (await svc((q) => q.query<{ name: string }>("select name from public.campaigns where id = $1", [c.id]))).rows[0]?.name ?? "";
    await emitWebhook(c.workspace_id, "campaign.completed", c.id, { campaign_id: c.id, name, url: `${configuredSiteUrl() ?? brand.siteUrl}/app/campaigns/${c.id}` });
  }
}

export async function runDispatch(opts: { workspaceId?: string | null; now?: Date; ignoreGap?: boolean } = {}): Promise<DispatchSummary> {
  const now = opts.now ?? new Date();
  const secret = sessionSecret();
  const origin = configuredSiteUrl() ?? brand.siteUrl;
  const summary: DispatchSummary = { sent: 0, skipped: [], failed: 0 };
  if (!secret) return { ...summary, skipped: ["SESSION_SECRET missing"] };

  const campaigns = await svc((q) => runningCampaigns(q, opts.workspaceId ?? null));
  const usedMailboxes = new Set<string>();

  for (const c of campaigns) {
    if (usedMailboxes.has(c.account_id)) continue;
    if (c.account_status !== "connected") {
      await svc((q) => pauseCampaign(q, c.id));
      summary.skipped.push(`${c.id}: mailbox not connected (campaign paused)`);
      continue;
    }
    if (!inSendingWindow(now, c.schedule)) {
      summary.skipped.push(`${c.id}: outside sending hours`);
      continue;
    }
    const usage = await svc((q) => mailboxUsage(q, c.account_id, c.schedule.timezone));
    if (usage.today >= c.daily_cap) {
      summary.skipped.push(`${c.id}: daily limit reached`);
      continue;
    }
    if (!opts.ignoreGap && usage.lastAt && now.getTime() - new Date(usage.lastAt).getTime() < MIN_GAP_MS) {
      summary.skipped.push(`${c.id}: spacing between emails`);
      continue;
    }

    const due = await svc((q) => nextDue(q, c.id));
    if (!due) {
      await finish(c);
      continue;
    }
    const dispatchId = await svc((q) => claimDispatch(q, c.workspace_id, c.id, due.id, c.account_id, due.step));
    if (!dispatchId) continue; // another pass took it
    usedMailboxes.add(c.account_id);

    if (await svc((q) => isSuppressedEmail(q, c.workspace_id, due.email))) {
      await svc((q) => recordFailure(q, dispatchId, due.id, "cancelled", "On the do-not-contact list", due.step));
      continue;
    }

    const token = await accessTokenFor(c.account_id);
    if (!token.ok) {
      // Release the claim so the email goes out once the mailbox is reconnected.
      await svc(async (q) => {
        await q.query("delete from public.dispatches where id = $1", [dispatchId]);
        await pauseCampaign(q, c.id);
      });
      summary.skipped.push(`${c.id}: ${token.message} (campaign paused)`);
      continue;
    }

    const unsubToken = await signUnsubscribe({ ws: c.workspace_id, email: due.email }, secret);
    const isFollowUp = due.step > 0 && !!due.step_body;
    const text = isFollowUp ? renderFollowUp(due.step_body!, { business: due.business_name, sender: c.sender_name ?? "" }) : due.body;
    const subject = isFollowUp ? followUpSubject(due.subject) : due.subject;
    const body = withFooter(text, { businessAddress: c.business_address ?? "", unsubscribeUrl: unsubscribeUrl(origin, unsubToken) });
    // Our own Message-ID, kept so later follow-ups can reply to it (In-Reply-To / References).
    const rfcMessageId = `<${randomUUID()}@${c.account_email.split("@")[1] ?? "locenti.local"}>`;
    const threading: Record<string, string> = isFollowUp && due.message_ids.length ? { "In-Reply-To": due.message_ids[due.message_ids.length - 1], References: due.message_ids.join(" ") } : {};
    let raw: string;
    try {
      raw = toGmailRaw(
        buildMessage({
          from: { email: c.account_email, name: c.sender_name },
          to: due.email,
          subject,
          text: body,
          headers: { "Message-ID": rfcMessageId, ...threading, ...unsubscribeHeaders(`${origin}/api/unsubscribe/${unsubToken}`) },
        }),
      );
    } catch (e) {
      await svc((q) => recordFailure(q, dispatchId, due.id, "failed", `Message couldn't be built: ${(e as Error).message}`, due.step));
      summary.failed++;
      continue;
    }

    const sent = await sendRaw(token.token, raw, isFollowUp ? (due.thread_id ?? undefined) : undefined);
    if (sent.ok) {
      await svc((q) =>
        recordAccepted(q, { ws: c.workspace_id, dispatchId, enrollmentId: due.id, leadId: due.lead_id, campaignId: c.id, accountId: c.account_id, messageId: sent.id, threadId: sent.threadId, from: c.account_email, to: due.email, subject, body, step: due.step, rfcMessageId }),
      );
      summary.sent++;
      await emitWebhook(c.workspace_id, "email.sent", dispatchId, { campaign_id: c.id, lead_id: due.lead_id, to: due.email, subject, step: due.step, follow_up: isFollowUp, sent_at: new Date().toISOString() });
      await finish(c);
    } else if (sent.code === "network") {
      await svc((q) => recordFailure(q, dispatchId, due.id, "ambiguous", sent.message, due.step));
      summary.failed++;
    } else if (sent.code === "auth" || sent.code === "permission" || sent.code === "rate_limited") {
      // Mailbox-level problem: put this email back and pause, rather than failing every recipient.
      await svc(async (q) => {
        await q.query("delete from public.dispatches where id = $1", [dispatchId]);
        await pauseCampaign(q, c.id);
        if (sent.code !== "rate_limited") await markMailbox(q, c.account_id, { status: "needs_reconnect", lastError: sent.message });
      });
      summary.skipped.push(`${c.id}: ${sent.message} (campaign paused)`);
    } else {
      await svc((q) => recordFailure(q, dispatchId, due.id, "failed", sent.message, due.step));
      summary.failed++;
    }
  }
  return summary;
}
