import "server-only";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import { breakdowns, campaignStats, daily, funnel, recentActivity, sendingToday, totals } from "@/server/analytics-store";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

export const RANGES = { "7": 7, "30": 30, "90": 90 } as const;
export type RangeKey = keyof typeof RANGES;

/** Current period vs the one before it, for trend arrows. */
export async function getAnalytics(range: string, path = "/app/analytics") {
  const { user, workspace } = await requireWorkspace(path);
  const days = RANGES[(range in RANGES ? range : "30") as RangeKey];
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  return asQ(user.id, async (q) => {
    const [current, previous, series, pipe, campaigns, parts, activity, today] = await Promise.all([
      totals(q, workspace.id, from, now),
      totals(q, workspace.id, prevFrom, from),
      daily(q, workspace.id, days),
      funnel(q, workspace.id),
      campaignStats(q, workspace.id),
      breakdowns(q, workspace.id),
      recentActivity(q, workspace.id),
      sendingToday(q, workspace.id),
    ]);
    return { days, current, previous, series, funnel: pipe, campaigns, ...parts, activity, today };
  });
}

export function rate(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 1000) / 10 : null;
}
