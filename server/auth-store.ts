import { hashPassword, hashToken, newEmailToken, verifyPassword } from "@/lib/auth/password";

/**
 * Account rules for Google and email/password sign-in. Takes any query
 * function, so production (pg) and the database tests (PGlite) run the
 * same code. Must be called with server privileges (withService).
 */
export type Q = { query: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: R[] }> };

type UserRow = { id: string; email: string | null; password_hash: string | null; email_verified_at: string | null; auth_subject: string };

export const VERIFY_TTL_S = 60 * 60 * 24; // 24 hours
export const RESET_TTL_S = 60 * 60; // 1 hour
export const MAX_FAILURES = 8;
export const FAILURE_WINDOW_MIN = 15;

const norm = (e: string) => e.trim().toLowerCase();

async function findByEmail(q: Q, email: string) {
  return (await q.query<UserRow>("select id, email, password_hash, email_verified_at, auth_subject from auth.users where lower(email) = $1", [norm(email)])).rows[0];
}

/**
 * Google sign-in. Links to an existing account with the same email only if
 * that account's email was verified; an unverified password account is
 * taken over by the Google identity and its password is cleared, so nobody
 * can pre-register someone else's address.
 */
export async function googleSignIn(q: Q, subject: string, email: string, name: string): Promise<string> {
  const bySubject = (await q.query<{ id: string }>("update auth.users set last_sign_in_at = now(), email_verified_at = coalesce(email_verified_at, now()) where auth_subject = $1 returning id", [subject])).rows[0];
  if (bySubject) return bySubject.id;
  const existing = await findByEmail(q, email);
  if (existing) {
    await q.query(
      `update auth.users set auth_subject = $2, last_sign_in_at = now(),
         password_hash = case when email_verified_at is null then null else password_hash end,
         email_verified_at = coalesce(email_verified_at, now())
       where id = $1`,
      [existing.id, subject],
    );
    if (!existing.email_verified_at) await q.query("update auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [existing.id]);
    return existing.id;
  }
  const created = await q.query<{ id: string }>(
    `insert into auth.users (auth_subject, email, raw_user_meta_data, email_verified_at, last_sign_in_at)
     values ($1, $2, jsonb_build_object('full_name', $3::text), now(), now()) returning id`,
    [subject, norm(email), name],
  );
  return created.rows[0].id;
}

export type SignUpResult =
  | { kind: "verify"; userId: string; token: string } // send a verification link
  | { kind: "exists" }; // already verified: tell them to sign in or reset (by email, not on screen)

/** Creates (or refreshes, if still unverified) a password account and a verification token. */
export async function passwordSignUp(q: Q, email: string, password: string, name: string): Promise<SignUpResult> {
  const e = norm(email);
  const existing = await findByEmail(q, e);
  if (existing?.email_verified_at) return { kind: "exists" };
  const hash = await hashPassword(password);
  let userId: string;
  if (existing) {
    await q.query("update auth.users set password_hash = $2, raw_user_meta_data = jsonb_build_object('full_name', $3::text) where id = $1", [existing.id, hash, name]);
    userId = existing.id;
  } else {
    userId = (
      await q.query<{ id: string }>(
        "insert into auth.users (auth_subject, email, password_hash, raw_user_meta_data) values ($1, $2, $3, jsonb_build_object('full_name', $4::text)) returning id",
        [`email:${e}`, e, hash, name],
      )
    ).rows[0].id;
  }
  return { kind: "verify", userId, token: await issueToken(q, userId, "verify_email", VERIFY_TTL_S) };
}

async function issueToken(q: Q, userId: string, purpose: "verify_email" | "reset_password", ttlS: number) {
  // Older unused links of the same kind stop working.
  await q.query("update auth.email_tokens set used_at = now() where user_id = $1 and purpose = $2 and used_at is null", [userId, purpose]);
  const token = newEmailToken();
  await q.query("insert into auth.email_tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, now() + make_interval(secs => $4))", [userId, purpose, hashToken(token), ttlS]);
  return token;
}

async function consumeToken(q: Q, token: string, purpose: "verify_email" | "reset_password"): Promise<string | null> {
  const r = await q.query<{ user_id: string }>(
    "update auth.email_tokens set used_at = now() where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now() returning user_id",
    [hashToken(token), purpose],
  );
  return r.rows[0]?.user_id ?? null;
}

export async function verifyEmail(q: Q, token: string): Promise<string | null> {
  const userId = await consumeToken(q, token, "verify_email");
  if (userId) await q.query("update auth.users set email_verified_at = coalesce(email_verified_at, now()) where id = $1", [userId]);
  return userId;
}

export type SignInResult = { kind: "ok"; userId: string } | { kind: "invalid" } | { kind: "unverified" } | { kind: "throttled" };

export async function passwordSignIn(q: Q, email: string, password: string, ip: string | null): Promise<SignInResult> {
  const e = norm(email);
  const failures = (
    await q.query<{ n: number }>(
      `select count(*)::int as n from auth.sign_in_attempts where lower(email) = $1 and succeeded = false and created_at > now() - make_interval(mins => $2)`,
      [e, FAILURE_WINDOW_MIN],
    )
  ).rows[0].n;
  if (failures >= MAX_FAILURES) return { kind: "throttled" };
  const user = await findByEmail(q, e);
  // Verify against a dummy hash when there's no user, so timing doesn't reveal which emails exist.
  const ok = await verifyPassword(password, user?.password_hash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  await q.query("insert into auth.sign_in_attempts (email, ip, succeeded) values ($1, $2, $3)", [e, ip, ok && !!user]);
  if (!ok || !user) return { kind: "invalid" };
  if (!user.email_verified_at) return { kind: "unverified" };
  await q.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]);
  return { kind: "ok", userId: user.id };
}

/** Returns a reset token only for existing accounts; callers show the same message either way. */
export async function requestPasswordReset(q: Q, email: string): Promise<string | null> {
  const user = await findByEmail(q, email);
  return user ? issueToken(q, user.id, "reset_password", RESET_TTL_S) : null;
}

/** Sets the new password, marks the email verified (they used the inbox) and signs out everywhere. */
export async function resetPassword(q: Q, token: string, newPassword: string): Promise<string | null> {
  const userId = await consumeToken(q, token, "reset_password");
  if (!userId) return null;
  await q.query("update auth.users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) where id = $1", [userId, await hashPassword(newPassword)]);
  await q.query("update auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [userId]);
  return userId;
}

export async function resendVerification(q: Q, email: string): Promise<string | null> {
  const user = await findByEmail(q, email);
  if (!user || user.email_verified_at || !user.password_hash) return null;
  return issueToken(q, user.id, "verify_email", VERIFY_TTL_S);
}
