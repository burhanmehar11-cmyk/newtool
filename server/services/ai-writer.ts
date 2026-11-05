import "server-only";
import { accessProblem } from "@/server/services/billing";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildDraftPrompt, checkDraftOutput, DRAFT_RESPONSE_SCHEMA, type DraftFact } from "@/lib/ai/draft-prompt";
import { nicheWords } from "@/lib/discovery/niches";
import { requireWorkspace, type WorkspaceRef } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { generateJson, geminiKey, geminiModel } from "@/server/ai/gemini";
import { bumpRevision, campaignRecipients, getCampaign, saveDraft } from "@/server/campaign-store";
import { withUser } from "@/server/db";
import { leadDetail } from "@/server/research-store";
import { getOfferProfileFor } from "@/server/services/workspaces";

type Ctx = { user: { id: string }; workspace: WorkspaceRef };
const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));
const uuid = z.string().uuid();
export type WriteResult = { ok: true; subject: string } | { ok: false; error: string };

export function aiWriterStatus() {
  return { configured: !!geminiKey(), model: geminiModel() };
}

/**
 * Writes a first email for one lead with Gemini, from the sender's offer and
 * the lead's Opportunity Brief only. Uses one AI unit (released if writing
 * fails). Saved as a new draft version (origin "ai") for review; draft
 * campaigns containing the lead need approval again.
 */
export async function writeDraftAs(ctx: Ctx, leadId: string): Promise<WriteResult> {
  if (!["owner", "admin"].includes(ctx.workspace.role)) return { ok: false, error: "Only workspace owners and admins can write drafts." };
  {
    const why = await accessProblem(ctx.workspace.id);
    if (why) return { ok: false, error: why };
  }
  if (!uuid.safeParse(leadId).success) return { ok: false, error: "Lead not found." };
  if (!geminiKey()) return { ok: false, error: "The AI writer isn't set up yet. Add GEMINI_API_KEY on the server (see the Agent page)." };
  const offer = await getOfferProfileFor(ctx.user.id, ctx.workspace.id);
  if (!offer) return { ok: false, error: "Add your offer profile in Settings first." };
  const d = await asQ(ctx.user.id, (q) => leadDetail(q, leadId));
  if (!d) return { ok: false, error: "Lead not found." };
  if (!d.brief) return { ok: false, error: "Research this lead first, so the email can be based on what its website shows." };

  const sources = new Map(d.evidence.map((e) => [e.id, e]));
  const facts: DraftFact[] = d.brief.facts.slice(0, 6).map((f, i) => {
    const ev = f.evidenceIds.map((id) => sources.get(id)).find(Boolean);
    return { n: i + 1, text: f.text, source: ev?.label ?? null, excerpt: ev?.excerpt ?? null };
  });
  const prompt = buildDraftPrompt({
    offer,
    business: { name: d.business.name, niche: d.business.niche ? nicheWords(d.business.niche).singular : null, city: d.business.city, domain: d.business.domain_normalized },
    facts,
    opportunities: d.brief.opportunities.slice(0, 3).map((o) => o.text),
    angle: d.brief.angle || null,
  });

  const key = `ai:${randomUUID()}`;
  try {
    await asQ(ctx.user.id, (q) => q.query("select public.reserve_usage($1, 'ai', 1, $2, $3)", [ctx.workspace.id, key, "AI draft"]));
  } catch (e) {
    return { ok: false, error: String((e as Error).message).includes("quota_exceeded") ? "This workspace's AI allowance is used up." : "Couldn't reserve AI usage. Try again." };
  }
  const settle = (used: number) => asQ(ctx.user.id, (q) => q.query("select public.settle_usage($1, $2, $3, $4)", [ctx.workspace.id, key, used, used ? "AI draft written" : "AI draft failed"]));

  const r = await generateJson(prompt.system, prompt.user, DRAFT_RESPONSE_SCHEMA);
  if (!r.ok) {
    await settle(0);
    return { ok: false, error: r.message };
  }
  const checked = checkDraftOutput(r.text, offer.bookingLink, facts.length);
  if (!checked.ok) {
    await settle(0);
    return { ok: false, error: `${checked.reason} Try again, or write it yourself.` };
  }
  await asQ(ctx.user.id, async (q) => {
    const factIds = checked.usedFacts.map((n) => d.brief!.facts[n - 1]?.id).filter((x): x is string => !!x);
    await saveDraft(q, ctx.workspace.id, ctx.user.id, leadId, { subject: checked.subject, body: checked.body, factIds, origin: "ai" });
    const camps = await q.query<{ id: string }>("select c.id from public.campaigns c join public.campaign_recipients r on r.campaign_id = c.id where r.lead_id = $1 and c.status = 'draft'", [leadId]);
    for (const c of camps.rows) await bumpRevision(q, c.id);
  });
  await settle(1);
  return { ok: true, subject: checked.subject };
}

export async function writeDraft(leadId: string) {
  return writeDraftAs(await requireWorkspace(`/app/leads/${leadId}`), leadId);
}

/** Writes AI drafts for every researched recipient of a draft campaign (up to 25 per run). */
export async function writeCampaignDrafts(campaignId: string): Promise<{ ok: true; written: number; failed: number; firstError: string | null } | { ok: false; error: string }> {
  const ctx = await requireWorkspace(`/app/campaigns/${campaignId}`);
  if (!uuid.safeParse(campaignId).success) return { ok: false, error: "Campaign not found." };
  const rows = await asQ(ctx.user.id, async (q) => {
    const c = await getCampaign(q, campaignId);
    if (!c || c.status !== "draft") return null;
    return campaignRecipients(q, campaignId);
  });
  if (!rows) return { ok: false, error: "AI drafts can only be written before launch." };
  const todo = rows.filter((r) => r.has_brief).slice(0, 25);
  let written = 0;
  let failed = 0;
  let firstError: string | null = null;
  // A few at a time keeps within free-tier rate limits.
  for (let i = 0; i < todo.length; i += 3) {
    const out = await Promise.all(todo.slice(i, i + 3).map((r) => writeDraftAs(ctx, r.lead_id)));
    for (const o of out) {
      if (o.ok) written++;
      else {
        failed++;
        firstError ??= o.error;
      }
    }
    if (firstError && /isn't set up|allowance|rejected|free limit/.test(firstError)) break;
  }
  return { ok: true, written, failed, firstError };
}
