import "server-only";
import { adminEmails, isAdminEmail } from "@/lib/admin";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";

/**
 * Who can open the admin panel: the owners in ADMIN_EMAILS (permanent, set in
 * Vercel) plus admins added from Admin → Admins (stored in app.admin_users).
 * Only owners can add or remove admins.
 */

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));

export function isOwnerEmail(email: string | null | undefined) {
  return isAdminEmail(email);
}

export async function isPlatformAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  try {
    return (await svc((q) => q.query("select 1 from app.admin_users where email = $1", [email.trim().toLowerCase()]))).rows.length > 0;
  } catch {
    return false; // migration 0020 not run yet: owners only
  }
}

/** Added admins (not the owners). */
export async function addedAdmins(): Promise<{ email: string; added_by: string; created_at: string }[]> {
  try {
    return (await svc((q) => q.query<{ email: string; added_by: string; created_at: string }>("select email, added_by, created_at from app.admin_users order by created_at"))).rows;
  } catch {
    return [];
  }
}

/** Everyone with admin access: owners first, then added admins (for alerts such as new support requests). */
export async function allAdminEmails(): Promise<string[]> {
  return [...new Set([...adminEmails(), ...(await addedAdmins()).map((a) => a.email)])];
}

export async function grantAdmin(q: Q, email: string, by: string): Promise<boolean> {
  const r = await q.query("insert into app.admin_users (email, added_by) values ($1, $2) on conflict (email) do nothing returning email", [email.toLowerCase(), by]);
  if (r.rows.length) await q.query("insert into app.admin_audit (admin_email, action, target, details) values ($1, 'grant_admin', $2, '{}'::jsonb)", [by, email.toLowerCase()]);
  return r.rows.length > 0;
}

export async function revokeAdmin(q: Q, email: string, by: string): Promise<boolean> {
  const r = await q.query("delete from app.admin_users where email = $1 returning email", [email.toLowerCase()]);
  if (r.rows.length) await q.query("insert into app.admin_audit (admin_email, action, target, details) values ($1, 'revoke_admin', $2, '{}'::jsonb)", [by, email.toLowerCase()]);
  return r.rows.length > 0;
}
