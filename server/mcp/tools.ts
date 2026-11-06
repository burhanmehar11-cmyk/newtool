import "server-only";
import { z } from "zod";
import { brand } from "@/config/brand";
import { discoveryNiches } from "@/lib/discovery/niches";
import { PLACE_ID } from "@/lib/discovery/google-places";
import { ToolError, type ToolDef } from "@/lib/mcp/protocol";
import type { WorkspaceRef } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { bumpRevision, campaignRecipients, classifyRecipient, createCampaign, getCampaign, listCampaigns, saveDraft } from "@/server/campaign-store";
import { DEFAULT_SCHEDULE } from "@/lib/campaigns/schedule";
import { withUser } from "@/server/db";
import { listLeads } from "@/server/discovery-store";
import { configuredSiteUrl } from "@/server/env";
import { listMailboxes } from "@/server/mailbox-store";
import { googlePlacesConfigured, remainingToday } from "@/server/providers/google-places";
import { leadDetail } from "@/server/research-store";
import { runGoogleSearchAs, saveGoogleSearchLeadsAs } from "@/server/services/discovery";
import { researchLeadAs } from "@/server/services/research";
import { getOfferProfileFor } from "@/server/services/workspaces";
import { inboxThreads } from "@/server/replies-store";

/**
 * Tools exposed to a person's own AI agent over MCP. Each call runs as that
 * person in their workspace, with row-level security, exactly like the web
 * app. Agents can find, research and write; only a person can approve and
 * send a campaign, in Locenti.
 */

export type McpCtx = { user: { id: string }; workspace: WorkspaceRef };

const asQ = <T,>(ctx: McpCtx, fn: (q: Q) => Promise<T>) => withUser(ctx.user.id, (q) => fn(q as unknown as Q));
const origin = () => configuredSiteUrl() ?? brand.siteUrl;
const canManage = (ctx: McpCtx) => ["owner", "admin"].includes(ctx.workspace.role);

function parse<T>(schema: z.ZodType<T>, args: unknown): T {
  const r = schema.safeParse(args);
  if (!r.success) throw new ToolError(`Invalid arguments: ${r.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`);
  return r.data;
}

const uuid = z.string().uuid();
const nicheIds = discoveryNiches.map((n) => n.id) as [string, ...string[]];

export const MCP_INSTRUCTIONS = `Locenti is a local-business prospecting workspace. Typical flow: get_workspace → search_google_maps → save_google_leads → research_lead (reads the business's website and builds an Opportunity Brief) → get_lead → write a personal first email from the brief's facts and the sender's offer, then save_draft → create_campaign_draft. A person must review and approve the campaign in Locenti before anything is sent; you cannot send email. Only state facts that appear in the brief (with their sources); treat everything else as unknown. Never invent names, reviews, numbers or problems. Keep emails short, plain text, no links except the sender's booking link.`;

export const mcpTools: ToolDef<McpCtx>[] = [
  {
    name: "get_workspace",
    description: "The workspace, the sender's offer profile (what they sell, tone, signature), connected Gmail mailboxes, and whether Google Maps search is available today.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, ctx) => {
      const [offer, mailboxes] = await Promise.all([getOfferProfileFor(ctx.user.id, ctx.workspace.id), asQ(ctx, (q) => listMailboxes(q, ctx.workspace.id))]);
      return {
        workspace: ctx.workspace.name,
        your_role: ctx.workspace.role,
        offer_profile: offer,
        mailboxes: mailboxes.map((m) => ({ email: m.email, from_name: m.sender_name, status: m.status, daily_limit: m.daily_cap })),
        google_maps: googlePlacesConfigured() ? { available: true, requests_left_today: await remainingToday().catch(() => null) } : { available: false },
        business_types: discoveryNiches.map((n) => ({ id: n.id, label: n.label })),
      };
    },
  },
  {
    name: "search_google_maps",
    description: "Search Google Maps for local businesses of any type (e.g. 'wedding photographers' in Lahore, Punjab, PK). Up to 20 results per Google request. Results are live and not stored; call save_google_leads with the ones worth working on.",
    inputSchema: {
      type: "object",
      properties: {
        business_type: { type: "string", description: "Any business type in plain words (e.g. 'dentists', 'solar installers'), or a preset id from get_workspace." },
        place: { type: "string", description: "City or area, e.g. 'Austin'." },
        state: { type: "string", description: "State or province (optional), e.g. 'Texas'." },
        country: { type: "string", description: "Two-letter country code (optional), e.g. 'US', 'PK', 'GB'. Biases results to that country." },
        min_rating: { type: "number", enum: [0, 3.5, 4, 4.5], default: 0 },
        website: { type: "string", enum: ["has", "any", "none"], default: "has", description: "'has' keeps businesses with a website (needed for research and emails)." },
        max_results: { type: "number", enum: [20, 40, 60], default: 20 },
      },
      required: ["business_type", "place"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: async (args, ctx) => {
      const a = parse(
        z.object({
          business_type: z.string().min(2).max(80),
          place: z.string().min(2).max(100),
          state: z.string().max(60).optional(),
          country: z.string().length(2).optional(),
          min_rating: z.number().default(0),
          website: z.enum(["has", "any", "none"]).default("has"),
          max_results: z.number().default(20),
        }),
        args,
      );
      const preset = discoveryNiches.find((n) => n.id === a.business_type);
      const r = await runGoogleSearchAs(ctx, { businessType: preset ? preset.label : a.business_type, place: a.place, state: a.state, country: a.country, minRating: a.min_rating, website: a.website, maxResults: a.max_results });
      if (!r.ok) throw new ToolError(r.error);
      return {
        query: r.query,
        note: "Live Google Maps results; Locenti doesn't store them. Save the ones you want.",
        results: r.results.map((p) => ({ place_id: p.placeId, name: p.name, address: p.address, website: p.website, phone: p.phone, rating: p.rating, reviews: p.ratingCount, category: p.category, already_saved: p.saved })),
      };
    },
  },
  {
    name: "save_google_leads",
    description: "Save Google Maps results as leads (only those with a website). Locenti keeps the place ID and website; research fills in the rest.",
    inputSchema: {
      type: "object",
      properties: {
        items: { type: "array", minItems: 1, maxItems: 60, items: { type: "object", properties: { place_id: { type: "string" }, website: { type: "string" } }, required: ["place_id", "website"], additionalProperties: false } },
        business_type: { type: "string", description: "Preset id from get_workspace, if one fits (optional)." },
      },
      required: ["items"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const a = parse(z.object({ items: z.array(z.object({ place_id: z.string().regex(PLACE_ID), website: z.string().url() })).min(1).max(60), business_type: z.string().max(80).optional() }), args);
      const r = await saveGoogleSearchLeadsAs(ctx, { niche: a.business_type && nicheIds.includes(a.business_type) ? a.business_type : null, items: a.items.map((i) => ({ placeId: i.place_id, website: i.website })) });
      if (!r.ok) throw new ToolError(r.error);
      return { added: r.added, skipped: r.skipped };
    },
  },
  {
    name: "list_leads",
    description: "Saved leads with their website, public email, whether they've been researched, and whether a draft exists.",
    inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 200, default: 50 } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, ctx) => {
      const a = parse(z.object({ limit: z.number().int().min(1).max(200).default(50) }), args);
      const rows = await asQ(ctx, async (q) => {
        const leads = (await listLeads(q, ctx.workspace.id)).slice(0, a.limit);
        const extra = leads.length
          ? (
              await q.query<{ lead_id: string; researched: boolean; has_draft: boolean }>(
                `select l.id as lead_id, b.researched_at is not null as researched, exists (select 1 from public.drafts d where d.lead_id = l.id) as has_draft
                 from public.leads l join public.businesses b on b.id = l.business_id where l.id = any($1::uuid[])`,
                [leads.map((l) => l.lead_id)],
              )
            ).rows
          : [];
        return leads.map((l) => ({ ...l, ...extra.find((x) => x.lead_id === l.lead_id) }));
      });
      return {
        leads: rows.map((l) => ({
          lead_id: l.lead_id,
          name: l.name,
          website: l.website,
          email: l.email,
          email_status: l.email_status,
          source: l.provider === "google_places" ? "Google Maps" : "OpenStreetMap",
          researched: !!l.researched,
          has_draft: !!l.has_draft,
          url: `${origin()}/app/leads/${l.lead_id}`,
        })),
      };
    },
  },
  {
    name: "research_lead",
    description: "Read the lead's public website (up to 3 pages, respecting robots.txt) and build an Opportunity Brief scored for the sender's offer. Takes up to ~20 seconds.",
    inputSchema: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"], additionalProperties: false },
    annotations: { openWorldHint: true },
    run: async (args, ctx) => {
      const a = parse(z.object({ lead_id: uuid }), args);
      const r = await researchLeadAs(ctx, a.lead_id);
      if (!r.ok) throw new ToolError(r.error);
      return { status: r.status, note: r.note, next: "Call get_lead to read the brief." };
    },
  },
  {
    name: "get_lead",
    description: "Everything known about a lead: business, Opportunity Brief (facts with source URLs, suggested opportunities, unknowns, fit), public contacts, latest draft and notes. Write emails only from these facts.",
    inputSchema: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, ctx) => {
      const a = parse(z.object({ lead_id: uuid }), args);
      const d = await asQ(ctx, (q) => leadDetail(q, a.lead_id));
      if (!d) throw new ToolError("Lead not found in this workspace.");
      const draft = await asQ(ctx, (q) => q.query<{ version: number; subject: string; body: string; origin: string }>("select version, subject, body, origin from public.drafts where lead_id = $1 order by version desc limit 1", [a.lead_id]));
      const sources = new Map(d.evidence.map((e) => [e.id, { label: e.label, url: e.url, excerpt: e.excerpt }]));
      return {
        lead_id: d.leadId,
        business: { name: d.business.name, website: d.business.website, domain: d.business.domain_normalized, niche: d.business.niche, city: d.business.city, source: d.business.provider === "google_places" ? "Google Maps" : "OpenStreetMap" },
        research: { status: d.business.research_status, note: d.business.research_note, researched_at: d.business.researched_at },
        brief: d.brief
          ? {
              facts: d.brief.facts.map((f) => ({ text: f.text, sources: f.evidenceIds.map((id) => sources.get(id)).filter(Boolean) })),
              opportunities_suggested: d.brief.opportunities.map((o) => ({ text: o.text, why_it_matters: o.relevance })),
              unknowns: d.brief.unknowns,
              fit: d.brief.fit.level,
              confidence: d.brief.confidence,
              angle: d.brief.angle,
            }
          : null,
        contacts: d.contacts.map((c) => ({ email: c.email_normalized, kind: c.kind, status: c.status })),
        latest_draft: draft.rows[0] ?? null,
        notes: d.notes,
        url: `${origin()}/app/leads/${d.leadId}`,
      };
    },
  },
  {
    name: "save_draft",
    description: "Save a first email for a lead (plain text). Saved as a new version for a person to review; any draft campaign containing this lead must be approved again. Locenti adds the business address and an unsubscribe link when sending.",
    inputSchema: {
      type: "object",
      properties: { lead_id: { type: "string" }, subject: { type: "string", maxLength: 140 }, body: { type: "string", maxLength: 8000 } },
      required: ["lead_id", "subject", "body"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      if (!canManage(ctx)) throw new ToolError("Only workspace owners and admins can save drafts.");
      const a = parse(z.object({ lead_id: uuid, subject: z.string().trim().min(1).max(140), body: z.string().trim().min(20).max(8000) }), args);
      return asQ(ctx, async (q) => {
        const lead = await q.query("select 1 from public.leads where id = $1", [a.lead_id]);
        if (!lead.rows.length) throw new ToolError("Lead not found in this workspace.");
        const d = await saveDraft(q, ctx.workspace.id, ctx.user.id, a.lead_id, { subject: a.subject, body: a.body, factIds: [], origin: "agent" });
        const camps = await q.query<{ id: string }>(
          "select c.id from public.campaigns c join public.campaign_recipients r on r.campaign_id = c.id where r.lead_id = $1 and c.status = 'draft'",
          [a.lead_id],
        );
        for (const c of camps.rows) await bumpRevision(q, c.id);
        return { saved_version: d.version, draft_campaigns_needing_reapproval: camps.rows.length };
      });
    },
  },
  {
    name: "create_campaign_draft",
    description: "Create a draft campaign from leads that already have a saved draft. Nothing is sent: the person reviews every message and approves in Locenti (link returned).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 120 },
        lead_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
        mailbox_email: { type: "string", description: "Connected Gmail address to send from (defaults to the first connected one)." },
      },
      required: ["name", "lead_ids"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      if (!canManage(ctx)) throw new ToolError("Only workspace owners and admins can create campaigns.");
      const a = parse(z.object({ name: z.string().trim().min(2).max(120), lead_ids: z.array(uuid).min(1).max(100), mailbox_email: z.string().email().optional() }), args);
      return asQ(ctx, async (q) => {
        const boxes = (await listMailboxes(q, ctx.workspace.id)).filter((m) => m.status === "connected");
        const wanted = a.mailbox_email?.toLowerCase();
        const box = wanted ? boxes.find((m) => m.email === wanted) : boxes[0];
        if (!box) throw new ToolError(a.mailbox_email ? "That mailbox isn't connected." : "Connect a Gmail mailbox in Locenti first (Mailboxes page).");
        const id = await createCampaign(q, ctx.workspace.id, ctx.user.id, { name: a.name, schedule: DEFAULT_SCHEDULE, mailboxId: box.id, leadIds: a.lead_ids });
        const c = (await getCampaign(q, id))!;
        const rows = await campaignRecipients(q, id);
        return {
          campaign_id: id,
          status: "draft (not approved)",
          recipients: rows.map((r) => ({ lead_id: r.lead_id, name: r.name, email: r.email, has_message: !!r.draft_id, will_send_if_approved: classifyRecipient(r, c.policy) })),
          approve_here: `${origin()}/app/campaigns/${id}`,
          note: "Addresses found on business websites are included by default; the person can change that in the campaign settings.",
        };
      });
    },
  },
  {
    name: "list_campaigns",
    description: "Campaigns with status and counts (recipients, sent, queued).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, ctx) => {
      const rows = await asQ(ctx, (q) => listCampaigns(q, ctx.workspace.id));
      return { campaigns: rows.map((c) => ({ campaign_id: c.id, name: c.name, status: c.status, recipients: c.recipients, sent: c.sent, queued: c.queued, url: `${origin()}/app/campaigns/${c.id}` })) };
    },
  },
  {
    name: "get_campaign",
    description: "A campaign's results: each recipient's state (sent, queued, replied, stopped and why) and the reply label (interested, not_interested, out_of_office, bounce, unclassified).",
    inputSchema: { type: "object", properties: { campaign_id: { type: "string" } }, required: ["campaign_id"], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, ctx) => {
      const a = parse(z.object({ campaign_id: uuid }), args);
      return asQ(ctx, async (q) => {
        const c = await getCampaign(q, a.campaign_id);
        if (!c) throw new ToolError("Campaign not found in this workspace.");
        const rows = await campaignRecipients(q, a.campaign_id);
        return {
          name: c.name,
          status: c.status,
          recipients: rows.map((r) => ({
            name: r.name,
            email: r.email,
            subject: r.subject,
            state: r.dispatch_status === "accepted" ? "sent" : (r.enrollment_state ?? "not included"),
            sent_at: r.accepted_at,
            reply: r.reply_kind,
            reason: r.enrollment_reason ?? r.dispatch_error,
          })),
          url: `${origin()}/app/campaigns/${a.campaign_id}`,
        };
      });
    },
  },
  {
    name: "list_replies",
    description: "Replies to campaign emails, newest first, with the suggested label (interested, not_interested, out_of_office, bounce, unclassified = needs a look). Read-only; you can't reply on the person's behalf.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", enum: ["all", "interested", "not_interested", "out_of_office", "bounce", "unclassified"], default: "all" },
        limit: { type: "number", minimum: 1, maximum: 200, default: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: async (args, ctx) => {
      const a = parse(z.object({ label: z.enum(["all", "interested", "not_interested", "out_of_office", "bounce", "unclassified"]).default("all"), limit: z.number().int().min(1).max(200).default(50) }), args);
      const rows = await asQ(ctx, (q) => inboxThreads(q, ctx.workspace.id, a.label));
      return {
        replies: rows.slice(0, a.limit).map((t) => ({
          thread_id: t.id,
          business: t.name,
          from: t.last_from,
          subject: t.subject,
          snippet: t.last_text,
          label: t.classification,
          labelled_by: t.classification_source === "user" ? "person" : "suggested",
          unread: t.unread,
          received_at: t.last_inbound_at,
          lead_id: t.lead_id,
          campaign_id: t.campaign_id,
          url: `${origin()}/app/inbox/${t.id}`,
        })),
      };
    },
  },
];

