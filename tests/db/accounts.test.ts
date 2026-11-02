import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { googleSignIn, MAX_FAILURES, passwordSignIn, passwordSignUp, requestPasswordReset, resendVerification, resetPassword, verifyEmail, type Q } from "@/server/auth-store";
import { AUTH_SQL } from "@/server/db-sql";
import { createTestDb } from "./harness";

let db: PGlite;
let q: Q;
beforeAll(async () => {
  db = await createTestDb();
  q = db as unknown as Q;
}, 60_000);

describe("email and password accounts", () => {
  it("requires email verification before sign-in", async () => {
    const r = await passwordSignUp(q, "Owner@Agency.example", "a long enough password", "Owner");
    expect(r.kind).toBe("verify");
    expect(await passwordSignIn(q, "owner@agency.example", "a long enough password", null)).toEqual({ kind: "unverified" });
    if (r.kind !== "verify") throw new Error();
    expect(await verifyEmail(q, r.token)).toBe(r.userId);
    expect(await verifyEmail(q, r.token)).toBeNull(); // single use
    expect(await passwordSignIn(q, "OWNER@agency.example", "a long enough password", "1.2.3.4")).toEqual({ kind: "ok", userId: r.userId });
  });

  it("rejects wrong passwords and unknown emails the same way", async () => {
    expect(await passwordSignIn(q, "owner@agency.example", "wrong password!!", null)).toEqual({ kind: "invalid" });
    expect(await passwordSignIn(q, "nobody@agency.example", "whatever password", null)).toEqual({ kind: "invalid" });
  });

  it("does not re-register a verified email", async () => {
    expect(await passwordSignUp(q, "owner@agency.example", "another password 123", "X")).toEqual({ kind: "exists" });
  });

  it("throttles repeated failures", async () => {
    const r = await passwordSignUp(q, "slow@agency.example", "the right password", "S");
    if (r.kind === "verify") await verifyEmail(q, r.token);
    for (let i = 0; i < MAX_FAILURES; i++) await passwordSignIn(q, "slow@agency.example", "wrong-password-x", null);
    expect(await passwordSignIn(q, "slow@agency.example", "the right password", null)).toEqual({ kind: "throttled" });
  });

  it("resets a password with a single-use link and signs out other sessions", async () => {
    const user = (await db.query<{ id: string }>("select id from auth.users where email = 'owner@agency.example'")).rows[0];
    const s = (await db.query<{ id: string }>(AUTH_SQL.createSession, [user.id, 3600, "t"])).rows[0];
    const token = await requestPasswordReset(q, "owner@agency.example");
    expect(token).toBeTruthy();
    expect(await requestPasswordReset(q, "nobody@agency.example")).toBeNull();
    expect(await resetPassword(q, token!, "brand new password 1")).toBe(user.id);
    expect(await resetPassword(q, token!, "again new password 2")).toBeNull();
    expect((await db.query(AUTH_SQL.findSession, [s.id, user.id])).rows).toHaveLength(0);
    expect(await passwordSignIn(q, "owner@agency.example", "brand new password 1", null)).toMatchObject({ kind: "ok" });
  });

  it("invalidates older verification links when a new one is sent", async () => {
    const r = await passwordSignUp(q, "late@agency.example", "late password 123", "L");
    if (r.kind !== "verify") throw new Error();
    const newer = await resendVerification(q, "late@agency.example");
    expect(await verifyEmail(q, r.token)).toBeNull();
    expect(await verifyEmail(q, newer!)).toBe(r.userId);
  });
});

describe("Google and password for the same email", () => {
  it("links Google to a verified password account", async () => {
    const pw = (await db.query<{ id: string }>("select id from auth.users where email = 'owner@agency.example'")).rows[0].id;
    expect(await googleSignIn(q, "google:999", "owner@agency.example", "Owner")).toBe(pw);
    expect(await googleSignIn(q, "google:999", "owner@agency.example", "Owner")).toBe(pw);
    expect(await passwordSignIn(q, "owner@agency.example", "brand new password 1", null)).toMatchObject({ kind: "ok", userId: pw });
  });

  it("stops a pre-registered, unverified password account from keeping access", async () => {
    // Someone registers a victim's email with their own password but can't verify it.
    const r = await passwordSignUp(q, "victim@agency.example", "attacker password!", "Attacker");
    if (r.kind !== "verify") throw new Error();
    // The real owner signs in with Google: same account, attacker's password removed.
    expect(await googleSignIn(q, "google:victim", "victim@agency.example", "Victim")).toBe(r.userId);
    expect(await passwordSignIn(q, "victim@agency.example", "attacker password!", null)).toEqual({ kind: "invalid" });
    // And the old verification link no longer grants anything useful: the password is gone.
    await verifyEmail(q, r.token);
    expect(await passwordSignIn(q, "victim@agency.example", "attacker password!", null)).toEqual({ kind: "invalid" });
  });

  it("creates a fresh, verified account for a new Google user", async () => {
    const id = await googleSignIn(q, "google:new", "New@Agency.example", "New");
    const row = (await db.query<{ email: string; email_verified_at: string | null }>("select email, email_verified_at from auth.users where id = $1", [id])).rows[0];
    expect(row.email).toBe("new@agency.example");
    expect(row.email_verified_at).not.toBeNull();
  });
});
