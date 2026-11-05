"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";
import { passwordProblem } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/safe-redirect";
import { accountsConfigured } from "@/server/env";
import { withService } from "@/server/db";
import { emailConfigured, existingAccountText, resetEmailText, sendEmail, verifyEmailText } from "@/server/email";
import {
  passwordSignIn,
  passwordSignUp,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  type Q,
} from "@/server/auth-store";
import { appOrigin, clientIp, startSession } from "@/server/session";

export type FormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** The sign-in failed because the email isn't confirmed yet. */
  unverifiedEmail?: string;
  /** Echoed back so the form keeps what the user typed (React resets forms after an action). */
  values?: { email?: string; name?: string };
};

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const NOT_CONFIGURED: FormState = { error: "Sign-in isn't configured in this environment yet." };
const NO_EMAIL: FormState = { error: "Email sign-up isn't available yet. Continue with Google instead." };
const NOT_INVITED = "This email doesn't have access yet. Ask the workspace owner to add it.";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));

export async function signInWithPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!accountsConfigured()) return NOT_CONFIGURED;
  const values = { email: String(form.get("email") ?? "").slice(0, 254) };
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.").max(128) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { values, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  if (!isAllowedBetaEmail(parsed.data.email)) return { values, error: NOT_INVITED };

  const ip = await clientIp();
  const r = await svc((q) => passwordSignIn(q, parsed.data.email, parsed.data.password, ip));
  if (r.kind === "throttled") return { values, error: "Too many attempts. Wait 15 minutes, or reset your password." };
  if (r.kind === "invalid") return { values, error: "That email and password don't match an account." };
  if (r.kind === "unverified") return { values, error: "Confirm your email first. Check your inbox for the link.", unverifiedEmail: parsed.data.email };
  await startSession(r.userId);
  redirect(safeNextPath(String(form.get("next") ?? "")));
}

export async function signUpWithPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!accountsConfigured()) return NOT_CONFIGURED;
  if (!emailConfigured()) return NO_EMAIL;
  const parsed = z
    .object({ name: z.string().trim().min(2, "Add your name.").max(120), email, password: z.string() })
    .safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  const fieldErrors: Record<string, string> = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
  const values = { email: String(form.get("email") ?? "").slice(0, 254), name: String(form.get("name") ?? "").slice(0, 120) };
  const pw = String(form.get("password") ?? "");
  const pwProblem = passwordProblem(pw);
  if (pwProblem) fieldErrors.password = pwProblem;
  if (!parsed.success || pwProblem) return { values, fieldErrors };
  if (!isAllowedBetaEmail(parsed.data.email)) return { values, error: NOT_INVITED };

  const origin = await appOrigin();
  const r = await svc((q) => passwordSignUp(q, parsed.data.email, pw, parsed.data.name));
  try {
    if (r.kind === "verify") {
      await sendEmail(parsed.data.email, "Confirm your email", verifyEmailText(`${origin}/api/auth/verify?token=${r.token}`));
    } else {
      await sendEmail(parsed.data.email, "You already have an account", existingAccountText(`${origin}/sign-in`, `${origin}/forgot-password`));
    }
  } catch {
    return { values, error: "We couldn't send the confirmation email. Try again in a few minutes." };
  }
  // Same message either way, so the form doesn't reveal which emails have accounts.
  return { message: `Check ${parsed.data.email} for a confirmation link. It expires in 24 hours.` };
}

export async function resendVerificationAction(emailAddress: string): Promise<FormState> {
  if (!accountsConfigured() || !emailConfigured()) return NO_EMAIL;
  const e = email.safeParse(emailAddress);
  if (!e.success || !isAllowedBetaEmail(e.data)) return { message: "If that account needs confirming, a new link is on its way." };
  const token = await svc((q) => resendVerification(q, e.data));
  if (token) {
    try {
      await sendEmail(e.data, "Confirm your email", verifyEmailText(`${await appOrigin()}/api/auth/verify?token=${token}`));
    } catch {
      return { error: "We couldn't send the email. Try again in a few minutes." };
    }
  }
  return { message: "If that account needs confirming, a new link is on its way." };
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!accountsConfigured()) return NOT_CONFIGURED;
  if (!emailConfigured()) return { error: "Password reset by email isn't available yet. Continue with Google instead." };
  const e = email.safeParse(form.get("email"));
  if (!e.success) return { values: { email: String(form.get("email") ?? "").slice(0, 254) }, fieldErrors: { email: e.error.issues[0].message } };
  const generic: FormState = { message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." };
  if (!isAllowedBetaEmail(e.data)) return generic;
  const token = await svc((q) => requestPasswordReset(q, e.data));
  if (token) {
    try {
      await sendEmail(e.data, "Reset your password", resetEmailText(`${await appOrigin()}/reset-password?token=${token}`));
    } catch {
      return { error: "We couldn't send the email. Try again in a few minutes." };
    }
  }
  return generic;
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!accountsConfigured()) return NOT_CONFIGURED;
  const token = String(form.get("token") ?? "");
  const pw = String(form.get("password") ?? "");
  const problem = passwordProblem(pw);
  if (problem) return { fieldErrors: { password: problem } };
  if (pw !== String(form.get("confirm") ?? "")) return { fieldErrors: { confirm: "Passwords don't match." } };
  const userId = token ? await svc((q) => resetPassword(q, token, pw)) : null;
  if (!userId) return { error: "This reset link has expired or was already used. Request a new one." };
  await startSession(userId);
  redirect("/app");
}
