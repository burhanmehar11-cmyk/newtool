import type { Metadata } from "next";
import { Suspense } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { plans } from "@/config/plans";
import { CheckoutButton } from "@/features/billing/checkout-button";
import { PageLoading } from "@/features/product/page-loading";
import { getCurrentUser } from "@/server/auth";
import { getBilling } from "@/server/services/billing";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const PLAN_LABEL: Record<string, string> = { trial: "Free trial", free: "Free", paid: "Paid", comp: "Complimentary", lapsed: "Ended" };
const STATUS: Record<string, string> = { active: "Active", trialing: "Trial", past_due: "Payment failed, retrying", paused: "Paused", canceled: "Cancelled" };

export default function BillingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Billing />
    </Suspense>
  );
}

async function Billing() {
  const [b, user] = await Promise.all([getBilling(), getCurrentUser()]);
  const a = b.account;
  const current = a?.plan_id ? plans.find((p) => p.id === a.plan_id) : null;
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Billing</h1>
        <p className="mt-1 text-sm text-slate">
          {current ? current.name : (PLAN_LABEL[b.plan] ?? b.plan)}
          {b.plan === "trial" ? ` · ${b.trialDaysLeft > 0 ? `${b.trialDaysLeft} days left, until ${formatDate(b.trialEndsAt)}` : "ended"}` : a?.cancel_at ? ` · ends ${formatDate(a.cancel_at)}` : a?.period_ends_at ? ` · renews ${formatDate(a.period_ends_at)}` : ""}
          {a?.status && a.status !== "active" ? ` · ${STATUS[a.status]}` : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const priceId = b.checkout?.prices[p.id] ?? null;
          const isCurrent = current?.id === p.id && a?.status !== "canceled";
          return (
            <section key={p.id} className={`card flex flex-col p-6 ${p.highlight ? "ring-2 ring-green/40" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-ink">{p.name}</h2>
                {isCurrent ? <Badge tone="green">Current plan</Badge> : p.highlight ? <Badge tone="info">Popular</Badge> : null}
              </div>
              <p className="mt-1.5 min-h-10 text-sm text-slate">{p.summary}</p>
              <p className="mt-4 font-display text-2xl font-bold text-ink">{p.monthlyPriceUsd !== null ? `$${p.monthlyPriceUsd}/mo` : <span className="text-base font-medium text-slate">Price shown at checkout</span>}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-ink">
                <li className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> {p.monthlyGrant.discovery.toLocaleString("en-US")} businesses found a month</li>
                <li className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> {p.monthlyGrant.ai.toLocaleString("en-US")} AI-written briefs and emails a month</li>
                <li className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> Unused units roll over</li>
                {p.groups.flatMap((g) => g.items).slice(0, 3).map((it) => (
                  <li key={it} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> {it}</li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <p className="text-center text-sm text-slate">You&apos;re on this plan.</p>
                ) : !b.canManage ? (
                  <p className="text-center text-xs text-slate">Only owners and admins can change the plan.</p>
                ) : b.checkout && priceId ? (
                  <CheckoutButton priceId={priceId} workspaceId={b.workspace.id} email={user?.email ?? null} clientToken={b.checkout.clientToken} environment={b.checkout.environment} label={a?.status === "active" ? `Switch to ${p.name}` : `Choose ${p.name}`} variant={p.highlight ? "primary" : "secondary"} />
                ) : (
                  <p className="text-center text-xs text-slate">You&apos;re on the free trial. Paid plans open soon.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {b.canManage && a && (a.manage_url || a.cancel_url) ? (
        <section className="card mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Manage your subscription</h2>
            <p className="text-sm text-slate">Card changes and cancellation open on a secure payment page. Cancelling keeps your plan until the end of the paid period.</p>
          </div>
          <div className="flex gap-2 text-sm font-medium">
            {a.manage_url ? <a href={a.manage_url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 hover:bg-canvas">Update payment method</a> : null}
            {a.cancel_url ? <a href={a.cancel_url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-danger-fg hover:bg-canvas">Cancel subscription</a> : null}
          </div>
        </section>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-slate">Switching plans opens a new checkout; cancel the old subscription from the link above once the new one is active.</p>
    </div>
  );
}
