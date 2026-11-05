import "server-only";
import { plans, type PlanId } from "@/config/plans";
import { normalizePaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";
import { trialDays } from "@/lib/admin";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import * as store from "@/server/billing-store";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));

/* ---------------------------------------------------------- configuration */

export function billingConfig() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? "";
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV?.trim() === "production" ? "production" : "sandbox";
  const prices = Object.fromEntries(plans.map((p) => [p.id, process.env[p.priceEnv]?.trim() || null])) as Record<PlanId, string | null>;
  return {
    checkoutReady: !!token && Object.values(prices).some(Boolean),
    webhookReady: !!process.env.PADDLE_WEBHOOK_SECRET?.trim(),
    clientToken: token,
    environment: env as "sandbox" | "production",
    prices,
    enforce: process.env.BILLING_ENFORCE?.trim() === "true",
  };
}

export function planForPrice(priceId: string | null): PlanId | null {
  if (!priceId) return null;
  const { prices } = billingConfig();
  return (Object.entries(prices).find(([, v]) => v === priceId)?.[0] as PlanId | undefined) ?? null;
}

/* -------------------------------------------------------------- access */

/**
 * Why this workspace can't use paid features right now, or null if it can.
 * Only enforced with BILLING_ENFORCE=true (off until the owner launches
 * billing): an ended trial or a lapsed subscription blocks searches,
 * research, AI writing and sending; viewing data never stops.
 */
export async function accessProblem(workspaceId: string): Promise<string | null> {
  if (!billingConfig().enforce) return null;
  try {
    const w = (
      await svc((q) =>
        q.query<{ plan: string; ended: boolean }>(
          "select plan, (plan = 'trial' and coalesce(trial_ends_at, created_at + make_interval(days => $2::int)) < now()) as ended from public.workspaces where id = $1",
          [workspaceId, trialDays()],
        ),
      )
    ).rows[0];
    if (!w) return null;
    if (w.plan === "lapsed") return "Your subscription has ended. Choose a plan in Billing to keep finding and emailing leads; your data is safe.";
    if (w.ended) return "Your free trial has ended. Choose a plan in Billing to keep finding and emailing leads; your data is safe.";
    return null;
  } catch {
    return null; // never block on a billing lookup failure
  }
}

/* ------------------------------------------------------------ billing page */

export async function getBilling() {
  const { workspace } = await requireWorkspace("/app/billing");
  const cfg = billingConfig();
  const canManage = ["owner", "admin"].includes(workspace.role);
  const info = await svc(async (q) => {
    const w = (
      await q.query<{ plan: string; trial_ends_at: string; trial_days_left: number }>(
        `select plan, coalesce(trial_ends_at, created_at + make_interval(days => $2::int)) as trial_ends_at,
           ceil(extract(epoch from (coalesce(trial_ends_at, created_at + make_interval(days => $2::int)) - now())) / 86400)::int as trial_days_left
         from public.workspaces where id = $1`,
        [workspace.id, trialDays()],
      )
    ).rows[0];
    const account = canManage ? await store.getAccount(q, workspace.id).catch(() => null) : null;
    return { ...w, account };
  });
  return {
    workspace,
    canManage,
    plan: info.plan,
    trialEndsAt: info.trial_ends_at,
    trialDaysLeft: info.trial_days_left,
    account: info.account,
    checkout: cfg.checkoutReady ? { clientToken: cfg.clientToken, environment: cfg.environment, prices: cfg.prices } : null,
    enforce: cfg.enforce,
  };
}

/* ------------------------------------------------------------ webhooks */

/** Handles a Paddle webhook: verify, store once, then apply. Returns the HTTP status to answer with. */
export async function handlePaddleWebhook(raw: string, signature: string | null): Promise<{ status: number; note: string }> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) return { status: 503, note: "Billing webhooks aren't set up (PADDLE_WEBHOOK_SECRET)." };
  if (!verifyPaddleSignature(signature, raw, secret)) return { status: 401, note: "Invalid signature." };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { status: 400, note: "Invalid JSON." };
  }
  const ev = normalizePaddleEvent(body);
  if (!ev) return { status: 200, note: "Ignored." };

  return svc(async (q) => {
    let ws = ev.workspaceId && (await store.workspaceExists(q, ev.workspaceId)) ? ev.workspaceId : null;
    const subId = ev.subscription?.id ?? ev.payment?.subscriptionId ?? null;
    if (!ws && subId) ws = await store.workspaceForSubscription(q, subId);
    const fresh = await store.recordEvent(q, "paddle", ev, ws, body);
    if (!fresh) return { status: 200, note: "Already processed." };
    if (!ws) return { status: 200, note: "No workspace for this event; stored for review." };

    if (ev.subscription) await store.applySubscription(q, ws, "paddle", ev.subscription, planForPrice(ev.subscription.priceId));
    if (ev.payment?.subscriptionId) {
      const plan = plans.find((p) => p.id === planForPrice(ev.payment!.priceId));
      if (plan) await store.grantUnits(q, ws, plan.monthlyGrant);
    }
    return { status: 200, note: "Applied." };
  });
}

export async function getRevenue(days: number) {
  try {
    return { ready: true as const, ...(await svc((q) => store.revenue(q, days))) };
  } catch {
    return { ready: false as const };
  }
}
