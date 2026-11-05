import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizePaddleEvent, planForStatus, verifyPaddleSignature } from "@/lib/billing/paddle";

const SECRET = "pdl_ntfset_test_secret";
const sign = (body: string, ts: number, secret = SECRET) => `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;

describe("Paddle signature", () => {
  const body = '{"event_id":"evt_1","event_type":"subscription.created"}';
  const now = 1_800_000_000;
  it("accepts a valid signature, including during secret rotation", () => {
    expect(verifyPaddleSignature(sign(body, now), body, SECRET, now + 5)).toBe(true);
    const rotated = `ts=${now};h1=${"0".repeat(64)};h1=${sign(body, now).split("h1=")[1]}`;
    expect(verifyPaddleSignature(rotated, body, SECRET, now)).toBe(true);
  });
  it("rejects tampering, wrong secrets, stale timestamps and junk", () => {
    expect(verifyPaddleSignature(sign(body, now), body.replace("created", "canceled"), SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(sign(body, now, "other"), body, SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(sign(body, now), body, SECRET, now + 301)).toBe(false);
    expect(verifyPaddleSignature(null, body, SECRET, now)).toBe(false);
    expect(verifyPaddleSignature("h1=abc", body, SECRET, now)).toBe(false);
    expect(verifyPaddleSignature(sign(body, now), body, "", now)).toBe(false);
  });
});

describe("Paddle events", () => {
  const ws = "11111111-2222-4333-8444-555555555555";
  it("reads a subscription event", () => {
    const ev = normalizePaddleEvent({
      event_id: "evt_2",
      event_type: "subscription.updated",
      occurred_at: "2026-11-05T10:00:00Z",
      data: {
        id: "sub_1",
        status: "active",
        customer_id: "ctm_1",
        custom_data: { workspace_id: ws },
        items: [{ price: { id: "pri_growth" } }],
        current_billing_period: { starts_at: "2026-11-05T00:00:00Z", ends_at: "2026-12-05T00:00:00Z" },
        scheduled_change: { action: "cancel", effective_at: "2026-12-05T00:00:00Z" },
        management_urls: { update_payment_method: "https://pay.example/upd", cancel: "https://pay.example/cancel" },
      },
    });
    expect(ev).toMatchObject({ eventId: "evt_2", workspaceId: ws, subscription: { id: "sub_1", status: "active", priceId: "pri_growth", periodEndsAt: "2026-12-05T00:00:00Z", cancelAt: "2026-12-05T00:00:00Z", manageUrl: "https://pay.example/upd" } });
  });
  it("reads a completed payment, and ignores a bad workspace id", () => {
    const ev = normalizePaddleEvent({ event_id: "evt_3", event_type: "transaction.completed", data: { id: "txn_1", subscription_id: "sub_1", currency_code: "USD", custom_data: { workspace_id: "not-a-uuid" }, details: { totals: { grand_total: "4900" } }, items: [{ price: { id: "pri_growth" } }] } });
    expect(ev).toMatchObject({ workspaceId: null, payment: { id: "txn_1", subscriptionId: "sub_1", amountMinor: 4900, currency: "USD", priceId: "pri_growth" } });
  });
  it("returns null for junk and maps statuses to plans", () => {
    expect(normalizePaddleEvent(null)).toBeNull();
    expect(normalizePaddleEvent({ event_type: "x" })).toBeNull();
    expect(normalizePaddleEvent({ event_id: "e", event_type: "subscription.created", data: { id: "s", status: "weird" } })?.subscription).toBeUndefined();
    expect(planForStatus("active")).toBe("paid");
    expect(planForStatus("past_due")).toBe("paid");
    expect(planForStatus("canceled")).toBe("lapsed");
  });
});
