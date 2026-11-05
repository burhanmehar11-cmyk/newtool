import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paddle Billing adapter: webhook signature check and event normalising.
 *
 * Written from Paddle Billing's documented formats; NOT yet checked against
 * the live docs from this project's build environment (the docs host was
 * blocked). Before going live, test in Paddle's sandbox: send a test event
 * from the Paddle dashboard and confirm it shows up in Admin → Revenue.
 *
 * Signature header: `Paddle-Signature: ts=<unix seconds>;h1=<hex>` where
 * h1 = HMAC-SHA256(endpoint secret, `${ts}:${rawBody}`). Several h1 values
 * may appear while a secret is being rotated.
 */

export function verifyPaddleSignature(header: string | null, rawBody: string, secret: string, nowS = Math.floor(Date.now() / 1000), toleranceS = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(";").map((p) => p.trim().split("="));
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const sigs = parts.filter(([k]) => k === "h1").map(([, v]) => v ?? "");
  if (!ts || !/^\d+$/.test(ts) || !sigs.length) return false;
  if (Math.abs(nowS - Number(ts)) > toleranceS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "paused" | "canceled";
const STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due", "paused", "canceled"];

export type BillingEvent = {
  eventId: string;
  type: string;
  occurredAt: string | null;
  workspaceId: string | null;
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    customerId: string | null;
    priceId: string | null;
    periodEndsAt: string | null;
    cancelAt: string | null;
    manageUrl: string | null;
    cancelUrl: string | null;
  };
  payment?: { id: string; subscriptionId: string | null; amountMinor: number | null; currency: string | null; priceId: string | null };
};

const str = (v: unknown, max = 1000) => (typeof v === "string" && v.length <= max ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Turns a Paddle webhook body into the few fields Locenti uses. Returns null for anything it can't read. */
export function normalizePaddleEvent(body: unknown): BillingEvent | null {
  const e = obj(body);
  const eventId = str(e.event_id, 100);
  const type = str(e.event_type, 60);
  if (!eventId || !type) return null;
  const d = obj(e.data);
  const custom = obj(d.custom_data);
  const ws = str(custom.workspace_id, 40);
  const items = Array.isArray(d.items) ? d.items : [];
  const priceId = str(obj(obj(items[0]).price).id, 100) ?? str(obj(items[0]).price_id, 100);
  const out: BillingEvent = { eventId, type, occurredAt: str(e.occurred_at, 40), workspaceId: ws && UUID.test(ws) ? ws : null };

  if (type.startsWith("subscription.")) {
    const status = str(d.status, 20) as SubscriptionStatus | null;
    const id = str(d.id, 100);
    if (id && status && STATUSES.includes(status)) {
      const change = obj(d.scheduled_change);
      const urls = obj(d.management_urls);
      out.subscription = {
        id,
        status,
        customerId: str(d.customer_id, 100),
        priceId,
        periodEndsAt: str(obj(d.current_billing_period).ends_at, 40) ?? str(d.next_billed_at, 40),
        cancelAt: change.action === "cancel" ? str(change.effective_at, 40) : str(d.canceled_at, 40),
        manageUrl: str(urls.update_payment_method),
        cancelUrl: str(urls.cancel),
      };
    }
  }
  if (type === "transaction.completed" || type === "transaction.paid") {
    const totals = obj(obj(d.details).totals);
    const total = str(totals.grand_total, 30) ?? str(totals.total, 30);
    out.payment = {
      id: str(d.id, 100) ?? eventId,
      subscriptionId: str(d.subscription_id, 100),
      amountMinor: total && /^\d+$/.test(total) ? Number(total) : null,
      currency: str(d.currency_code, 3),
      priceId,
    };
  }
  return out;
}

/** The plan a workspace has while its subscription is in this state. */
export function planForStatus(status: SubscriptionStatus): "paid" | "lapsed" {
  return status === "canceled" || status === "paused" ? "lapsed" : "paid";
}
