"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { brand } from "@/config/brand";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type AuthFormState = { error?: string; message?: string; fieldErrors?: Record<string, string> };

const NOT_CONFIGURED: AuthFormState = { error: "Accounts are not configured in this environment yet." };
const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(10, "Use at least 10 characters.").max(128);

function errors(issues: { path: PropertyKey[]; message: string }[]): AuthFormState {
  return { error: "Check the highlighted fields.", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

export async function signInAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return errors(parsed.error.issues);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for every failure, so the form can't be used to discover accounts.
  if (error) return { error: "That email and password don't match an account, or the email isn't confirmed yet." };
  redirect(safeNextPath(String(form.get("next") ?? "")));
}

export async function signUpAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Add your name.").max(120), email, password })
    .safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return errors(parsed.error.issues);
  if (!isAllowedBetaEmail(parsed.data.email)) {
    return { error: "Sign-up is invite-only during the private beta. Use the email address your invite was sent to." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${brand.siteUrl}/auth/callback?next=/app/onboarding`,
      data: { full_name: parsed.data.fullName },
    },
  });
  // Same response whether or not the address already has an account.
  return { message: "Check your inbox for a confirmation link. It opens your workspace setup." };
}

export async function forgotPasswordAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email }).safeParse({ email: form.get("email") });
  if (!parsed.success) return errors(parsed.error.issues);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${brand.siteUrl}/auth/callback?next=/reset-password` });
  return { message: "If an account exists for that address, a reset link is on its way." };
}

export async function resetPasswordAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return errors(parsed.error.issues);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Couldn't update the password. Try a different one." };
  redirect("/app");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}
