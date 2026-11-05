import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail, trialDays } from "@/lib/admin";
import { attributionFrom, parseAttribution, sourceLabel } from "@/lib/attribution";

describe("sign-up source", () => {
  it("prefers utm tags, then the referring site, else direct", () => {
    expect(attributionFrom("https://locenti.com/?utm_source=LinkedIn&utm_medium=social&utm_campaign=Launch_Week", "https://www.google.com/", "locenti.com")).toEqual({
      source: "linkedin",
      medium: "social",
      campaign: "launch_week",
      referrerHost: "google.com",
      landingPath: "/",
    });
    expect(attributionFrom("https://locenti.com/pricing", "https://www.google.co.uk/search?q=x", "locenti.com")).toMatchObject({ source: "google", medium: "organic", landingPath: "/pricing" });
    expect(attributionFrom("https://locenti.com/", "https://t.co/abc", "locenti.com")).toMatchObject({ source: "x", medium: "referral" });
    expect(attributionFrom("https://locenti.com/", "https://someblog.example/post", "locenti.com")).toMatchObject({ source: "someblog.example" });
    expect(attributionFrom("https://locenti.com/", "https://locenti.com/legal/privacy", "locenti.com")).toMatchObject({ source: "direct", referrerHost: null });
    expect(attributionFrom("https://locenti.com/", null, "locenti.com")).toMatchObject({ source: "direct", medium: null });
  });

  it("strips anything odd and rejects malformed input from the browser", () => {
    expect(attributionFrom("https://locenti.com/?utm_source=<script>x", null, "locenti.com").source).toBe("scriptx");
    expect(parseAttribution('{"source":"google","medium":"organic","landingPath":"/pricing"}')).toMatchObject({ source: "google", landingPath: "/pricing" });
    expect(parseAttribution('{"source":"google","landingPath":"https://evil.example"}')?.landingPath).toBeNull();
    expect(parseAttribution("not json")).toBeNull();
    expect(parseAttribution('{"medium":"x"}')).toBeNull();
    expect(parseAttribution("x".repeat(3000))).toBeNull();
    expect(sourceLabel("producthunt")).toBe("Product Hunt");
    expect(sourceLabel("someblog.example")).toBe("someblog.example");
  });
});

describe("admin access", () => {
  it("allows only exact listed emails", () => {
    const list = "Owner@Locenti.com, ops@locenti.com, @locenti.com, not-an-email";
    expect(adminEmails(list)).toEqual(["owner@locenti.com", "ops@locenti.com"]);
    expect(isAdminEmail("owner@locenti.com", list)).toBe(true);
    expect(isAdminEmail("someone@locenti.com", list)).toBe(false); // no domain wildcards
    expect(isAdminEmail(null, list)).toBe(false);
    expect(isAdminEmail("owner@locenti.com", "")).toBe(false);
  });

  it("reads the trial length with a safe default", () => {
    expect(trialDays("21")).toBe(21);
    expect(trialDays("0")).toBe(14);
    expect(trialDays("abc")).toBe(14);
    expect(trialDays(undefined)).toBe(14);
  });
});
