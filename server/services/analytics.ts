import "server-only";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import { breakdowns, campaignStats, daily, dailyLeads, funnel, leadFunnel, leadQuality, leadsByNiche, leadTotals, opportunities, recentActivity, recentSearches, searchAreas, sendingToday, totals } from "@/server/analytics-store";

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

/** Lead-discovery analytics: the main view for a Google Maps lead tool. */
export async function getLeadAnalytics(range: string, path = "/app/analytics") {
  const { user, workspace } = await requireWorkspace(path);
  const days = RANGES[(range in RANGES ? range : "30") as RangeKey];
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  return asQ(user.id, async (q) => {
    const [current, previous, series, pipe, quality, opps, niches, searches, areas] = await Promise.all([
      leadTotals(q, workspace.id, from, now),
      leadTotals(q, workspace.id, prevFrom, from),
      dailyLeads(q, workspace.id, days),
      leadFunnel(q, workspace.id),
      leadQuality(q, workspace.id),
      opportunities(q, workspace.id),
      leadsByNiche(q, workspace.id),
      recentSearches(q, workspace.id),
      searchAreas(q, workspace.id),
    ]);
    return { days, current, previous, series, funnel: pipe, quality, opportunities: opps, niches, searches, areas };
  });
}
