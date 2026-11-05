import type { Metadata } from "next";
import { Suspense } from "react";
import { Check, CreditCard } from "lucide-react";
import { PageHero } from "@/components/app/page-hero";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/misc";
import { plans } from "@/config/plans";
import { CheckoutButton } from "@/features/billing/checkout-button";
import { PageLoading } from "@/features/product/page-loading";
import { getCurrentUser } from "@/server/auth";
import { getBilling } from "@/server/services/billing";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const PLAN_LABEL: Record<string, string> = { trial: "Free trial", free: "Free", paid: "Paid", comp: "Complimentary", lapsed: "Ended" };
const STATUS: Record<string, string> = { active: "Active", trialing: "Trial (Paddle)", past_due: "Payment failed, retrying", paused: "Paused", canceled: "Cancelled" };

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
      <PageHero
        icon={CreditCard}
        eyebrow="Workspace"
        title="Billing"
        description={`Plans for ${b.workspace.name}. Payments are handled by Paddle, which also takes care of sales tax and invoices.`}
        stats={[
          { label: "Plan", value: current ? current.name : PLAN_LABEL[b.plan] ?? b.plan, hint: a?.status ? STATUS[a.status] : undefined },
          {
            label: b.plan === "trial" ? "Trial" : a?.cancel_at ? "Ends" : "Renews",
            value: b.plan === "trial" ? (b.trialDaysLeft > 0 ? `${b.trialDaysLeft} days left` : "Ended") : a?.cancel_at ? formatDate(a.cancel_at) : a?.period_ends_at ? formatDate(a.period_ends_at) : "—",
            hint: b.plan === "trial" ? `until ${formatDate(b.trialEndsAt)}` : undefined,
          },
          { label: "Payments", value: b.checkout ? (b.checkout.environment === "sandbox" ? "Test mode" : "Live") : "Not set up" },
        ]}
      />

      {a?.status === "past_due" ? (
        <Callout tone="warn" title="Your last payment didn't go through" className="mb-5">
          Paddle will retry it. Update your card to avoid interruption.{a.manage_url ? <> <a href={a.manage_url} target="_blank" rel="noreferrer">Update payment method</a>.</> : null}
        </Callout>
      ) : null}
      {b.plan === "lapsed" || (b.plan === "trial" && b.trialDaysLeft <= 0) ? (
        <Callout tone={b.enforce ? "warn" : "info"} title={b.plan === "lapsed" ? "Your subscription has ended" : "Your free trial has ended"} className="mb-5">
          {b.enforce ? "Searches, research, AI writing and sending are paused until you choose a plan. Everything you saved is still here." : "Choose a plan to keep going. Nothing is locked yet."}
        </Callout>
      ) : null}

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
                  <p className="text-center text-xs text-slate">Not available yet.</p>
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
            <p className="text-sm text-slate">Card changes and cancellation happen on Paddle&apos;s secure pages. Cancelling keeps your plan until the end of the paid period.</p>
          </div>
          <div className="flex gap-2 text-sm font-medium">
            {a.manage_url ? <a href={a.manage_url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 hover:bg-canvas">Update payment method</a> : null}
            {a.cancel_url ? <a href={a.cancel_url} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-danger-fg hover:bg-canvas">Cancel subscription</a> : null}
          </div>
        </section>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-slate">Switching plans opens a new checkout; cancel the old subscription from the link above once the new one is active. Prices include any tax Paddle adds for your country.</p>
    </div>
  );
}
