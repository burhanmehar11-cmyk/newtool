import { describe, expect, it } from "vitest";
import { describeSchedule, inSendingWindow, localParts } from "@/lib/campaigns/schedule";
import { isSuppressed, signUnsubscribe, unsubscribeHeaders, verifyUnsubscribe, withFooter } from "@/lib/campaigns/compose";
import { classifyRecipient } from "@/server/campaign-store";

const weekdays = { timezone: "America/New_York", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 };

describe("sending window", () => {
  it("uses the campaign's time zone", () => {
    // Tue 2026-11-03 14:30 UTC = 09:30 in New York (EST, UTC-5)
    const t = new Date("2026-11-03T14:30:00Z");
    expect(localParts(t, "America/New_York")).toEqual({ weekday: 2, hour: 9, date: "2026-11-03" });
    expect(inSendingWindow(t, weekdays)).toBe(true);
    expect(inSendingWindow(new Date("2026-11-03T13:59:00Z"), weekdays)).toBe(false); // 08:59
    expect(inSendingWindow(new Date("2026-11-03T22:00:00Z"), weekdays)).toBe(false); // 17:00, end is exclusive
    expect(inSendingWindow(new Date("2026-11-07T15:00:00Z"), weekdays)).toBe(false); // Saturday
  });
  it("describes itself", () => {
    expect(describeSchedule(weekdays)).toBe("Mon–Fri, 09:00–17:00 (America/New York)");
  });
});

describe("email footer and unsubscribe", () => {
  it("always appends the address and unsubscribe link", () => {
    const out = withFooter("Hi there,\n\nSam\n\n", { businessAddress: "1 Main St, Austin TX", unsubscribeUrl: "https://app.example/unsubscribe/t" });
    expect(out).toBe("Hi there,\n\nSam\n\n--\n1 Main St, Austin TX\nDon't want emails from me? Unsubscribe: https://app.example/unsubscribe/t");
    const signed = withFooter("Hi,\n\nSam\n1 Main St, Austin TX", { businessAddress: "1 Main St, Austin TX", unsubscribeUrl: "https://u.example/x" });
    expect(signed.match(/1 Main St/g)).toHaveLength(1);
    expect(unsubscribeHeaders("https://app.example/api/unsubscribe/t")).toEqual({ "List-Unsubscribe": "<https://app.example/api/unsubscribe/t>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("signs unsubscribe tokens that can't be forged", async () => {
    const t = await signUnsubscribe({ ws: "ws-1", email: "Info@Clinic.example" }, "s".repeat(40));
    expect(await verifyUnsubscribe(t, "s".repeat(40))).toEqual({ ws: "ws-1", email: "info@clinic.example" });
    expect(await verifyUnsubscribe(t, "x".repeat(40))).toBeNull();
    expect(await verifyUnsubscribe(t.slice(0, -2) + "aa", "s".repeat(40))).toBeNull();
  });

  it("matches emails and whole domains (including subdomains)", () => {
    const list = [
      { value: "owner@a.example", kind: "email" as const },
      { value: "b.example", kind: "domain" as const },
    ];
    expect(isSuppressed("OWNER@a.example", list)).toBe(true);
    expect(isSuppressed("info@a.example", list)).toBe(false);
    expect(isSuppressed("x@b.example", list)).toBe(true);
    expect(isSuppressed("x@mail.b.example", list)).toBe(true);
    expect(isSuppressed("x@notb.example", list)).toBe(false);
  });
});

describe("who gets sent to", () => {
  const base = { email: "info@clinic.example", email_status: "unverified", suppressed: false, draft_id: "d1" };
  const strict = { includeUnknown: false, includeCatchAll: false };
  const loose = { includeUnknown: true, includeCatchAll: true };
  it("never sends to invalid, suppressed, missing-email or no-message recipients", () => {
    expect(classifyRecipient({ ...base, email_status: "invalid" }, loose)).toMatchObject({ send: false });
    expect(classifyRecipient({ ...base, suppressed: true }, loose)).toMatchObject({ send: false, reason: "On the do-not-contact list" });
    expect(classifyRecipient({ ...base, email: null }, loose)).toMatchObject({ send: false });
    expect(classifyRecipient({ ...base, draft_id: null }, loose)).toMatchObject({ send: false });
  });
  it("includes unverified or catch-all only when the campaign allows it", () => {
    expect(classifyRecipient(base, strict)).toMatchObject({ send: false });
    expect(classifyRecipient(base, loose)).toEqual({ send: true });
    expect(classifyRecipient({ ...base, email_status: "unknown" }, loose)).toEqual({ send: true });
    expect(classifyRecipient({ ...base, email_status: "catch_all" }, strict)).toMatchObject({ send: false });
    expect(classifyRecipient({ ...base, email_status: "valid" }, strict)).toEqual({ send: true });
  });
});
