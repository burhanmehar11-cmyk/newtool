import { describe, expect, it } from "vitest";
import { evaluateClaims, isSameOrigin, MAX_AUTH_AGE_S } from "@/lib/session-policy";

const now = 1_800_000_000;
const base = { auth_time: now - 10, email: "a@agency.example", email_verified: true, firebase: { sign_in_provider: "password" } };

describe("session exchange policy", () => {
  it("accepts a fresh sign-in with a verified email", () => {
    expect(evaluateClaims(base, now)).toEqual({ ok: true });
  });
  it("rejects a sign-in older than the limit", () => {
    expect(evaluateClaims({ ...base, auth_time: now - MAX_AUTH_AGE_S - 1 }, now)).toMatchObject({ ok: false, code: "stale_sign_in" });
  });
  it("requires a verified email, including for password accounts", () => {
    expect(evaluateClaims({ ...base, email_verified: false }, now)).toMatchObject({ ok: false, code: "email_not_verified" });
    expect(evaluateClaims({ ...base, email: undefined }, now)).toMatchObject({ ok: false, code: "no_email" });
  });
});

describe("same-origin check", () => {
  it("accepts only the exact origin", () => {
    expect(isSameOrigin("https://app.locentio.example", "https://app.locentio.example")).toBe(true);
    expect(isSameOrigin("https://evil.example", "https://app.locentio.example")).toBe(false);
    expect(isSameOrigin("http://app.locentio.example", "https://app.locentio.example")).toBe(false);
    expect(isSameOrigin(null, "https://app.locentio.example")).toBe(false);
  });
});
