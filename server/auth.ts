import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Data access layer for identity and tenancy. Every product server function
 * goes through here, so authorisation is re-checked on each call, in
 * addition to the proxy gate and row-level security.
 */

export const ACTIVE_WORKSPACE_COOKIE = "locentio_ws";

export type CurrentUser = { id: string; email: string | null };
export type WorkspaceRef = { id: string; name: string; role: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  // getUser() validates the session with the auth server; do not trust cookie contents alone.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireUser(next = "/app"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

export async function listWorkspaces(): Promise<WorkspaceRef[]> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return [];
  const { data, error } = await supabase
    .from("memberships")
    .select("role, workspaces ( id, name )")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load workspaces: ${error.message}`);
  return (data ?? [])
    .map((m) => {
      const w = m.workspaces as unknown as { id: string; name: string } | null;
      return w ? { id: w.id, name: w.name, role: m.role as string } : null;
    })
    .filter((x): x is WorkspaceRef => !!x);
}

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
