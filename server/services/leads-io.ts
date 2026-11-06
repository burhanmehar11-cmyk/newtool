import "server-only";
import { z } from "zod";
import { toCsv, parseLeadsCsv } from "@/lib/csv";
import { googleMapsLink } from "@/lib/discovery/google-places";
import { requireWorkspace, isViewer, VIEW_ONLY } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import { emitLeadsCreated } from "@/server/services/webhooks";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

/**
 * CSV export of saved leads. Only data Locenti keeps: the business's name and
 * website (from its own site), its public emails, research results, notes and
 * a Google Maps link built from the place ID (which Google allows storing).
 * Google's terms forbid exporting Google Maps content, so none is included.
 */
export async function exportLeadsCsv(input: { leadIds?: string[] } = {}): Promise<{ ok: true; csv: string; filename: string; count: number } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/leads");
  const ids = z.array(z.string().uuid()).max(5000).optional().safeParse(input.leadIds);
  if (!ids.success) return { ok: false, error: "Nothing to export." };
  const rows = await asQ(user.id, (q) =>
    q.query<{
      name: string;
      website: string | null;
      emails: string | null;
      niche: string | null;
      city: string | null;
      provider: string;
      provider_ref: string;
      research_status: string | null;
      fit: string | null;
      notes: string;
      created_at: string;
    }>(
      `select b.name, b.website, b.niche, b.city, b.provider, b.provider_ref, b.research_status, l.notes, l.created_at,
         (select string_agg(c.email_normalized, '; ' order by c.created_at) from public.contacts c where c.business_id = b.id and c.status <> 'invalid') as emails,
         (select br.payload->'fit'->>'level' from public.briefs br where br.business_id = b.id order by br.created_at desc limit 1) as fit
       from public.leads l join public.businesses b on b.id = l.business_id
       where l.workspace_id = $1 and ($2::uuid[] is null or l.id = any($2::uuid[]))
       order by l.created_at desc limit 5000`,
      [workspace.id, ids.data?.length ? ids.data : null],
    ),
  );
  const source = (p: string) => (p === "google_places" ? "Google Maps" : p === "openstreetmap" ? "OpenStreetMap" : p === "csv" ? "Imported" : p);
  const csv = toCsv(
    ["Business", "Website", "Emails", "Business type", "City", "Source", "Google Maps link", "Research", "Fit", "Notes", "Saved"],
    rows.rows.map((r) => [
      r.name,
      r.website,
      r.emails,
      r.niche,
      r.city,
      source(r.provider),
      r.provider === "google_places" ? googleMapsLink(r.provider_ref, r.name) : null,
      r.research_status,
      r.fit,
      r.notes,
      new Date(r.created_at).toISOString().slice(0, 10),
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return { ok: true, csv, filename: `locenti-leads-${date}.csv`, count: rows.rows.length };
}

/** Leads for the given Google place IDs in this workspace (after saving search results). */
export async function leadIdsForPlaces(placeIds: string[]): Promise<string[]> {
  const { user, workspace } = await requireWorkspace("/app/discover");
  if (!placeIds.length) return [];
  const r = await asQ(user.id, (q) =>
    q.query<{ id: string }>(
      `select l.id from public.leads l join public.businesses b on b.id = l.business_id
       where l.workspace_id = $1 and b.provider = 'google_places' and b.provider_ref = any($2::text[])`,
      [workspace.id, placeIds.slice(0, 200)],
    ),
  );
  return r.rows.map((x) => x.id);
}

const domainOf = (website: string | null, email: string | null) => {
  if (website) {
    try {
      return new URL(website).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      /* fall through */
    }
  }
  return email ? email.split("@")[1] : null;
};

/**
 * Imports leads from a CSV (name plus website and/or email; optional type and
 * city). Duplicates (same website or email) are skipped. Emails are kept as
 * unverified, like any found address.
 */
export async function importLeadsCsv(text: string): Promise<{ ok: true; added: number; skipped: number; errors: string[] } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/leads");
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Choose a CSV file." };
  if (text.length > 2_000_000) return { ok: false, error: "The file is too large (2 MB at most)." };
  const parsed = parseLeadsCsv(text);
  if (!parsed.rows.length) return { ok: false, error: parsed.errors[0] ?? "No rows to import." };
  const since = new Date();
  const { added, skipped } = await asQ(user.id, async (q) => {
    let added = 0;
    let skipped = 0;
    for (const r of parsed.rows) {
      const domain = domainOf(r.website, r.email);
      const ref = `csv:${domain ?? r.email ?? r.name.toLowerCase()}`;
      const existing = (
        await q.query<{ id: string }>(
          `select b.id from public.businesses b where b.workspace_id = $1 and (b.provider_ref = $2 or ($3::text is not null and b.domain_normalized = $3)) limit 1`,
          [workspace.id, ref, domain],
        )
      ).rows[0];
      const businessId =
        existing?.id ??
        (
          await q.query<{ id: string }>(
            `insert into public.businesses (workspace_id, provider, provider_ref, name, website, domain_normalized, niche, city, attribution, collected_at)
             values ($1, 'csv', $2, $3, $4, $5, $6, $7, 'Imported from CSV', now()) returning id`,
            [workspace.id, ref, r.name, r.website, domain, r.niche, r.place],
          )
        ).rows[0].id;
      if (r.email) {
        await q.query(
          `insert into public.contacts (workspace_id, business_id, email_normalized, kind) values ($1, $2, $3, $4) on conflict (workspace_id, email_normalized) do nothing`,
          [workspace.id, businessId, r.email, /^(info|hello|contact|office|admin|sales|support|team|enquiries|inquiries)@/.test(r.email) ? "role" : "named"],
        );
      }
      const lead = await q.query("insert into public.leads (workspace_id, business_id, source, saved_by) values ($1, $2, 'import', $3) on conflict (workspace_id, business_id) do nothing returning id", [
        workspace.id,
        businessId,
        user.id,
      ]);
      if (lead.rows.length) added++;
      else skipped++;
    }
    return { added, skipped };
  });
  if (added) await emitLeadsCreated(workspace.id, since);
  return { ok: true, added, skipped, errors: parsed.errors.slice(0, 20) };
}
