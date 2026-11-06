import "server-only";
import { accessProblem } from "@/server/services/billing";
import { z } from "zod";
import { PLACE_ID } from "@/lib/discovery/google-places";
import { requireWorkspace, isViewer, VIEW_ONLY } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import { findEmailsOnWebsite, type EmailLookup } from "@/server/research/find-emails";
import { storeFoundEmails } from "@/server/email-store";
import { deliverableEmails } from "@/server/research/email-check";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

// Gentle on other people's websites: at most this many lookups per person per 10 minutes.
const LIMIT = 200;
const WINDOW_MS = 10 * 60_000;
const usage = new Map<string, number[]>();
function takeLookups(userId: string, n: number) {
  const now = Date.now();
  const recent = (usage.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length + n > LIMIT) return false;
  usage.set(userId, [...recent, ...Array(n).fill(now)]);
  return true;
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const resultsSchema = z.array(z.object({ placeId: z.string().regex(PLACE_ID), website: z.string().url().max(500) })).min(1).max(5);

export type ResultEmails = { placeId: string } & Pick<EmailLookup, "status" | "emails" | "siteName" | "note">;

/** Live email lookup for Google Maps results shown on screen (up to 5 per call). Nothing is stored until the person saves. */
export async function findEmailsForResults(input: unknown): Promise<{ ok: true; results: ResultEmails[] } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/discover");
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  {
    const why = await accessProblem(workspace.id);
    if (why) return { ok: false, error: why };
  }
  const p = resultsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Nothing to look up." };
  if (!takeLookups(user.id, p.data.length)) return { ok: false, error: "That's a lot of websites in a short time. Wait a few minutes, then continue." };
  const results = await pool(p.data, 5, async (it) => {
    const l = await findEmailsOnWebsite(it.website).catch(() => ({ status: "failed" as const, emails: [], siteName: null, note: "Lookup failed." }));
    return { placeId: it.placeId, ...l, emails: await deliverableEmails(l.emails) };
  });
  return { ok: true, results };
}

/** Finds missing emails for saved leads that have a website but no address yet (up to 15 per run). */
export async function findMissingLeadEmails(): Promise<{ ok: true; checked: number; found: number; remaining: number } | { ok: false; error: string }> {
  const { user, workspace } = await requireWorkspace("/app/leads");
  if (isViewer(workspace)) return { ok: false, error: VIEW_ONLY };
  {
    const why = await accessProblem(workspace.id);
    if (why) return { ok: false, error: why };
  }
  const todo = await asQ(user.id, (q) =>
    q.query<{ business_id: string; website: string; provider: string; name: string; domain_normalized: string | null }>(
      `select b.id as business_id, b.website, b.provider, b.name, b.domain_normalized from public.leads l join public.businesses b on b.id = l.business_id
       where l.workspace_id = $1 and b.website is not null
         and not exists (select 1 from public.contacts c where c.business_id = b.id)
         and not exists (select 1 from public.evidence e where e.business_id = b.id and e.label = 'Email lookup: none found' and e.collected_at > now() - interval '14 days')
       order by l.created_at desc limit 16`,
      [workspace.id],
    ),
  );
  const batch = todo.rows.slice(0, 15);
  if (!batch.length) return { ok: true, checked: 0, found: 0, remaining: 0 };
  if (!takeLookups(user.id, batch.length)) return { ok: false, error: "That's a lot of websites in a short time. Wait a few minutes, then try again." };
  const results = await pool(batch, 5, async (b) => {
    const l = await findEmailsOnWebsite(b.website).catch(() => null);
    return l ? { ...l, emails: await deliverableEmails(l.emails) } : null;
  });
  let found = 0;
  await asQ(user.id, async (q) => {
    for (const [i, r] of results.entries()) {
      const b = batch[i];
      if (!r) continue;
      if (r.emails.length) found += (await storeFoundEmails(q, workspace.id, b.business_id, r.emails)) ? 1 : 0;
      else if (r.status === "none") {
        // Remember the empty result for a while so the same sites aren't re-read on every click.
        await q.query("insert into public.evidence (workspace_id, business_id, kind, label, url, excerpt, collected_at) values ($1, $2, 'other', 'Email lookup: none found', $3, $4, now())", [workspace.id, b.business_id, b.website, r.note]);
      }
      if (r.siteName && b.provider === "google_places" && b.name === b.domain_normalized) {
        await q.query("update public.businesses set name = $2 where id = $1", [b.business_id, r.siteName.slice(0, 120)]);
      }
    }
  });
  return { ok: true, checked: batch.length, found, remaining: Math.max(0, todo.rows.length - batch.length) };
}
