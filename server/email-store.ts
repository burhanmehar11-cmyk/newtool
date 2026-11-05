import type { Q } from "@/server/auth-store";

export type StoredEmail = { email: string; kind: "role" | "named"; url: string };

/** Stores emails found on a business's site, each with the page it was found on as evidence. */
export async function storeFoundEmails(q: Q, ws: string, businessId: string, emails: StoredEmail[]) {
  let added = 0;
  for (const e of emails) {
    const ev = await q.query<{ id: string }>(
      `insert into public.evidence (workspace_id, business_id, kind, label, url, excerpt, collected_at)
       values ($1, $2, $3, 'Email shown on the website', $4, $5, now()) returning id`,
      [ws, businessId, /contact|about/i.test(new URL(e.url).pathname) ? "contact_page" : "homepage", e.url, `Email shown on page: ${e.email}`],
    );
    const c = await q.query(
      `insert into public.contacts (workspace_id, business_id, email_normalized, kind, source_evidence_id)
       values ($1, $2, $3, $4, $5) on conflict (workspace_id, email_normalized) do nothing returning id`,
      [ws, businessId, e.email.toLowerCase(), e.kind, ev.rows[0].id],
    );
    added += c.rows.length;
  }
  return added;
}

