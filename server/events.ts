import "server-only";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";

/**
 * One place to record what happened: the owner's activity log (with whether
 * it went well) and, optionally, a notification for people in the workspace.
 * Never throws and never blocks the action it records: if the tables aren't
 * there yet (migration 0016 not run) or the database hiccups, it does nothing.
 */

export type Area = "account" | "team" | "mailbox" | "prospecting" | "research" | "writing" | "campaign" | "sending" | "replies" | "agents" | "billing";
export type Outcome = "success" | "failed" | "warning" | "info";

export type Notify = {
  title: string;
  body?: string;
  /** In-app link, e.g. /app/campaigns/123. */
  href?: string;
  level?: Outcome;
  /** Who gets it: everyone in the workspace (default), owners and admins, or one person. */
  to?: "members" | "managers" | { userId: string };
  /** The same key is stored once per person (e.g. one "needs reconnecting" per mailbox per day). */
  dedupeKey?: string;
};

export type TrackEvent = {
  workspaceId?: string | null;
  userId?: string | null;
  email?: string | null;
  kind: string;
  area: Area;
  outcome: Outcome;
  summary: string;
  details?: Record<string, unknown>;
  notify?: Notify;
};

export async function track(e: TrackEvent): Promise<void> {
  try {
    await withService(async (raw) => {
      const q = raw as unknown as Q;
      await q.query(
        `insert into app.activity_events (workspace_id, user_id, email, kind, area, outcome, summary, details)
         values ($1, $2, coalesce($3, (select email from auth.users where id = $2)), $4, $5, $6, $7, $8::jsonb)`,
        [e.workspaceId ?? null, e.userId ?? null, e.email?.slice(0, 254) ?? null, e.kind.slice(0, 40), e.area, e.outcome, e.summary.slice(0, 500), JSON.stringify(e.details ?? {})],
      );
      if (e.notify && e.workspaceId) await notify(q, e.workspaceId, e.kind, e.outcome, e.notify);
    });
  } catch {
    // Recording must never break the thing being recorded.
  }
}

/** Notifications without an activity row (rare: use track with notify instead). */
export async function notifyWorkspace(workspaceId: string, kind: string, n: Notify): Promise<void> {
  try {
    await withService((raw) => notify(raw as unknown as Q, workspaceId, kind, n.level ?? "info", n));
  } catch {
    /* best effort */
  }
}

async function notify(q: Q, workspaceId: string, kind: string, outcome: Outcome, n: Notify) {
  const to = n.to ?? "members";
  const who = typeof to === "object" ? "m.user_id = $8" : to === "managers" ? "m.role in ('owner', 'admin')" : "true";
  const params: unknown[] = [workspaceId, kind.slice(0, 40), n.level ?? outcome, n.title.slice(0, 160), (n.body ?? "").slice(0, 600), n.href && n.href.startsWith("/") ? n.href.slice(0, 300) : null, n.dedupeKey?.slice(0, 200) ?? null];
  if (typeof to === "object") params.push(to.userId);
  await q.query(
    `insert into public.notifications (workspace_id, user_id, kind, level, title, body, href, dedupe_key)
     select $1, m.user_id, $2, $3, $4, $5, $6, $7 from public.memberships m where m.workspace_id = $1 and ${who}
     on conflict (user_id, workspace_id, dedupe_key) where dedupe_key is not null do nothing`,
    params,
  );
}
