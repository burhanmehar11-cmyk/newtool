"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthFormState,
} from "@/server/actions/auth";

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  state,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  state: AuthFormState;
  hint?: string;
}) {
  const err = state.fieldErrors?.[name];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input id={`f-${name}`} name={name} type={type} autoComplete={autoComplete} required aria-invalid={!!err} aria-describedby={err || hint ? `f-${name}-d` : undefined} />
      {err ? <FieldError id={`f-${name}-d`}>{err}</FieldError> : hint ? <FieldHint id={`f-${name}-d`}>{hint}</FieldHint> : null}
    </div>
  );
}

function Status({ state }: { state: AuthFormState }) {
  if (state.message) return <Callout tone="green"><span role="status">{state.message}</span></Callout>;
  if (state.error && !state.fieldErrors) return <Callout tone="danger"><span role="alert">{state.error}</span></Callout>;
  return null;
}

export function SignInForm() {
  const params = useSearchParams();
  const [state, action, pending] = React.useActionState(signInAction, {});
  const linkError = params.get("error") === "link";
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={params.get("next") ?? "/app"} />
      {linkError ? <Callout tone="warn">That link has expired or was already used. Sign in, or request a new link.</Callout> : null}
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" state={state} />
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-green hover:underline">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="font-medium text-green hover:underline">
          Have an invite? Create an account
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = React.useActionState(signUpAction, {});
  if (state.message) return <Status state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field name="fullName" label="Your name" autoComplete="name" state={state} />
      <Field name="email" label="Work email" type="email" autoComplete="email" state={state} hint="Use the address your beta invite was sent to." />
      <Field name="password" label="Password" type="password" autoComplete="new-password" state={state} hint="At least 10 characters." />
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-green hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = React.useActionState(forgotPasswordAction, {});
  if (state.message) return <Status state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = React.useActionState(resetPasswordAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field name="password" label="New password" type="password" autoComplete="new-password" state={state} hint="At least 10 characters." />
      <Field name="confirm" label="Confirm password" type="password" autoComplete="new-password" state={state} />
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
