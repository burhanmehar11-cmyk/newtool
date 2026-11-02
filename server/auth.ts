import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/tokens";
import { accountsConfigured, sessionSecret } from "@/server/env";
import { withService, withUser } from "@/server/db";
import { AUTH_SQL } from "@/server/db-sql";

/**
 * Data access layer for identity and tenancy. Every product server function
 * goes through here, so authorisation is re-checked on each call, on top of
 * the proxy gate and row-level security.
 */

export const ACTIVE_WORKSPACE_COOKIE = "locentio_ws";

export type CurrentUser = { id: string; sessionId: string; email: string | null };
export type WorkspaceRef = { id: string; name: string; role: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read cookies first so callers are always request-time.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !accountsConfigured()) return null;
  const claims = await verifySession(token, sessionSecret()!);
  if (!claims) return null;
  try {
    // The session row must exist, belong to this user, be unexpired and not revoked.
    const r = await withService((q) =>
      q.query<{ id: string; email: string | null }>(AUTH_SQL.findSession, [claims.sid, claims.uid]),
    );
    const row = r.rows[0];
    return row ? { id: row.id, sessionId: claims.sid, email: row.email } : null;
  } catch {
    return null;
  }
});

export async function requireUser(next = "/app"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

export const listWorkspaces = cache(async (): Promise<WorkspaceRef[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const r = await withUser(user.id, (q) =>
    q.query<WorkspaceRef>(
      `select w.id, w.name, m.role from public.memberships m
       join public.workspaces w on w.id = m.workspace_id
       where m.user_id = auth.uid() order by m.created_at`,
    ),
  );
  return r.rows;
});

/** The active workspace, validated against the user's memberships. */
export async function getActiveWorkspace(): Promise<WorkspaceRef | null> {
  const workspaces = await listWorkspaces();
  if (!workspaces.length) return null;
  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  return workspaces.find((w) => w.id === preferred) ?? workspaces[0];
}

/** For pages: signed in and with a workspace, or redirected to the right step. */
export async function requireWorkspace(next = "/app") {
  const user = await requireUser(next);
  const workspace = await getActiveWorkspace();
  if (!workspace) redirect("/app/onboarding");
  return { user, workspace };
}
