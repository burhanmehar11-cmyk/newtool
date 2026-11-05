import { describe, expect, it } from "vitest";
import { DEFAULT_FOLLOW_UPS, followUpProblem, followUpSubject, renderFollowUp, sendDays } from "@/lib/campaigns/followups";

describe("follow-up templates", () => {
  it("accepts the defaults and none at all", () => {
    expect(followUpProblem(DEFAULT_FOLLOW_UPS)).toBeNull();
    expect(followUpProblem([])).toBeNull();
  });

  it("limits count, wait, length, placeholders and links", () => {
    const ok = DEFAULT_FOLLOW_UPS[0];
    expect(followUpProblem([ok, ok, ok])).toMatch(/At most 2/);
    expect(followUpProblem([{ ...ok, delayDays: 0 }])).toMatch(/between 1 and 14 days/);
    expect(followUpProblem([{ ...ok, delayDays: 2.5 }])).toMatch(/between 1 and 14 days/);
    expect(followUpProblem([{ ...ok, body: "Too short" }])).toMatch(/at least 20/);
    expect(followUpProblem([{ ...ok, body: "x".repeat(1001) }])).toMatch(/under 1000/);
    expect(followUpProblem([{ ...ok, body: "Hello {first_name}, just checking in on this." }])).toMatch(/\{first_name\} isn't a placeholder/);
    expect(followUpProblem([{ ...ok, body: "See https://example.com for more on this offer." }])).toMatch(/links/);
  });

  it("fills in the business and sender", () => {
    expect(renderFollowUp("  Ideas for {business}?\n\n{sender}  ", { business: "Riverbend Dental", sender: "Sam" })).toBe("Ideas for Riverbend Dental?\n\nSam");
    expect(renderFollowUp("Ideas for {business}?", { business: " ", sender: "" })).toBe("Ideas for your business?");
  });

  it("replies to the first subject once, and counts days from the first email", () => {
    expect(followUpSubject("Quick idea for Riverbend")).toBe("Re: Quick idea for Riverbend");
    expect(followUpSubject("RE: already a reply")).toBe("RE: already a reply");
    expect(sendDays([{ delayDays: 3 }, { delayDays: 5 }])).toEqual([0, 3, 8]);
  });
});
