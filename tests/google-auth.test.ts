import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildAuthorizeUrl, checkIdTokenClaims, pkceChallenge, randomToken } from "@/lib/auth/oidc";
import { signSession, signState, verifySession, verifyState } from "@/lib/auth/tokens";

const SECRET = "test-secret-that-is-long-enough-123456";

describe("Google sign-in helpers", () => {
  it("derives the RFC 7636 S256 challenge", async () => {
    const v = randomToken();
    expect(await pkceChallenge(v)).toBe(createHash("sha256").update(v).digest("base64url"));
  });

  it("builds an authorize URL with only basic sign-in scopes and PKCE", () => {
    const u = new URL(buildAuthorizeUrl({ clientId: "cid", redirectUri: "https://x.example/api/auth/google/callback", state: "s", codeChallenge: "c", nonce: "n" }));
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("response_type")).toBe("code");
  });

  it("accepts a verified email with the right nonce", () => {
    expect(checkIdTokenClaims({ sub: "123", email: "A@Agency.example", email_verified: true, nonce: "n", name: "A" }, "n")).toEqual({
      ok: true,
      subject: "google:123",
      email: "a@agency.example",
      name: "A",
    });
  });

  it("rejects a wrong nonce, an unverified email or a missing subject", () => {
    expect(checkIdTokenClaims({ sub: "1", email: "a@x.example", email_verified: true, nonce: "other" }, "n")).toMatchObject({ ok: false, code: "nonce" });
    expect(checkIdTokenClaims({ sub: "1", email: "a@x.example", email_verified: false, nonce: "n" }, "n")).toMatchObject({ ok: false, code: "email_not_verified" });
    expect(checkIdTokenClaims({ email: "a@x.example", email_verified: true, nonce: "n" }, "n")).toMatchObject({ ok: false, code: "no_subject" });
  });
});

describe("signed tokens", () => {
  it("round-trips a session and rejects tampering or the wrong secret", async () => {
    const t = await signSession({ sid: "s1", uid: "u1" }, SECRET);
    expect(await verifySession(t, SECRET)).toEqual({ sid: "s1", uid: "u1" });
    expect(await verifySession(t, SECRET + "x")).toBeNull();
    expect(await verifySession(t.slice(0, -2) + "xx", SECRET)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const t = await signSession({ sid: "s1", uid: "u1" }, SECRET, -10);
    expect(await verifySession(t, SECRET)).toBeNull();
  });

  it("keeps state and session tokens from being swapped", async () => {
    const s = await signState({ state: "a", verifier: "b", nonce: "c", next: "/app" }, SECRET);
    expect(await verifyState(s, SECRET)).toEqual({ state: "a", verifier: "b", nonce: "c", next: "/app" });
    expect(await verifySession(s, SECRET)).toBeNull();
    const sess = await signSession({ sid: "s1", uid: "u1" }, SECRET);
    expect(await verifyState(sess, SECRET)).toBeNull();
  });
});
