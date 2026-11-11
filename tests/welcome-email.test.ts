import { describe, expect, it } from "vitest";
import { welcomeEmail } from "@/lib/welcome-email";

describe("welcome email content", () => {
  const v = { firstName: "Sam", site: "https://locenti.com", trialDays: 14, replyTo: "hello@locenti.com" };
  it("greets by name, names the trial, and links the three first steps", () => {
    const m = welcomeEmail(v);
    expect(m.subject).toBe("Welcome to Locenti, Sam");
    for (const path of ["/app/mailboxes", "/app/settings", "/app/discover", "/app"]) {
      expect(m.text).toContain(`https://locenti.com${path}`);
      expect(m.html).toContain(`href="https://locenti.com${path}"`);
    }
    expect(m.html).toContain("14-day free trial");
  });
  it("has a friendly fallback without a name, and escapes what it inserts", () => {
    expect(welcomeEmail({ ...v, firstName: "there" }).subject).toBe("Welcome to Locenti, let's find your first clients");
    expect(welcomeEmail({ ...v, firstName: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });
});

describe("sign-off", () => {
  it("is from Team Locenti, never a named founder", async () => {
    const { ANNOUNCEMENT_TEMPLATES } = await import("@/lib/announcements");
    const m = welcomeEmail({ firstName: "Sam", site: "https://locenti.com", trialDays: 14, replyTo: "hello@locenti.com" });
    for (const t of [m.text, m.html, ...ANNOUNCEMENT_TEMPLATES.map((x) => x.body)]) {
      expect(t).toContain("Team Locenti");
      expect(t).not.toMatch(/Burhan|Founder|\bI read\b/);
    }
  });
});
