"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { readAttribution } from "@/components/attribution-capture";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeNextPath } from "@/lib/safe-redirect";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
  signInWithPasswordAction,
  signUpWithPasswordAction,
  type FormState,
} from "@/server/actions/password";

const URL_ERRORS: Record<string, { tone: "danger" | "warn"; text: string }> = {
  not_invited: { tone: "warn", text: "This email doesn't have access yet. Ask the workspace owner to add your email." },
  cancelled: { tone: "warn", text: "Google sign-in was cancelled." },
  email_not_verified: { tone: "danger", text: "Google says this email isn't verified, so it can't be used to sign in." },
  state: { tone: "danger", text: "That sign-in took too long or was opened in another browser. Please try again." },
  link: { tone: "warn", text: "That link has expired or was already used. Request a new one below." },
  not_configured: { tone: "danger", text: "Sign-in isn't configured in this environment yet." },
};

const inputCls =
  "h-12 w-full rounded-[12px] border border-white/[0.12] bg-white/[0.05] px-4 text-[15px] text-white placeholder:text-white/35 transition-colors duration-200 hover:border-white/25 focus-visible:border-mint focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-mint/40 aria-[invalid=true]:border-[#ff8f86]";

function DarkField({
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  error,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
}) {
  const d = error || hint ? `f-${name}-d` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={`f-${name}`} className="block text-[14px] font-medium text-white/90">
        {label}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
        aria-invalid={!!error}
        aria-describedby={d}
        className={inputCls}
      />
      {error ? (
        <p id={d} role="alert" className="text-[13px] font-medium text-[#ffb4ad]">
          {error}
        </p>
      ) : hint ? (
        <p id={d} className="text-[13px] text-fog">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Notice({ tone, children }: { tone: "danger" | "warn" | "ok"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "ok" ? "status" : "alert"}
      className={cn(
        "rounded-[12px] border px-4 py-3 text-[14px] leading-6",
        tone === "ok" && "border-mint/30 bg-mint/10 text-mint",
        tone === "warn" && "border-[#f5c26b]/30 bg-[#f5c26b]/10 text-[#f8d79a]",
        tone === "danger" && "border-[#ff8f86]/30 bg-[#ff8f86]/10 text-[#ffc2bc]",
      )}
    >
      {children}
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-mint text-[15px] font-semibold text-midnight shadow-[0_10px_30px_-10px_rgb(143_240_192/0.6)] transition-[background-color,transform] duration-200 hover:bg-mint-strong active:translate-y-px disabled:opacity-60"
    >
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-5">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function GoogleButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  return (
    <a
      href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
      onClick={(e) => {
        // Carry how this visitor found us, in case Google creates a new account.
        const src = readAttribution();
        if (src) e.currentTarget.href = `/api/auth/google/start?next=${encodeURIComponent(next)}&src=${encodeURIComponent(src)}`;
      }}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-[12px] border border-white/[0.14] bg-white/[0.04] text-[15px] font-semibold text-white transition-colors duration-200 hover:border-white/30 hover:bg-white/[0.08]"
    >
      <GoogleIcon /> {label}
    </a>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-4 text-[13px] text-fog">
      <span className="h-px flex-1 bg-white/[0.12]" />
      {children}
      <span className="h-px flex-1 bg-white/[0.12]" />
    </div>
  );
}

function UrlError() {
  const err = useSearchParams().get("error");
  const m = err ? (URL_ERRORS[err] ?? { tone: "danger" as const, text: "Sign-in didn't complete. Please try again." }) : null;
  return m ? (
    <div className="mb-5">
      <Notice tone={m.tone}>{m.text}</Notice>
    </div>
  ) : null;
}

export function SignInForm({ emailEnabled }: { emailEnabled: boolean }) {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [state, action, pending] = React.useActionState<FormState, FormData>(signInWithPasswordAction, {});
  const [resend, setResend] = React.useState<FormState | null>(null);
  const [resending, startResend] = React.useTransition();
  return (
    <>
      <UrlError />
      <GoogleButton next={next} label="Sign in with Google" />
      <Divider>Or sign in with email</Divider>
      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <DarkField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@company.com" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
        <DarkField name="password" label="Password" type="password" autoComplete="current-password" placeholder="Your password" error={state.fieldErrors?.password} />
        <div className="flex items-center justify-between text-[14px]">
          <Link href="/forgot-password" className="font-medium text-mint hover:underline">
            Forgot your password?
          </Link>
          {emailEnabled ? (
            <Link href="/sign-up" className="text-fog hover:text-white">
              Create account
            </Link>
          ) : null}
        </div>
        {state.error ? (
          <Notice tone="danger">
            {state.error}
            {state.unverifiedEmail ? (
              <>
                {" "}
                <button
                  type="button"
                  disabled={resending}
                  className="font-semibold underline"
                  onClick={() => startResend(async () => setResend(await resendVerificationAction(state.unverifiedEmail!)))}
                >
                  Resend the link
                </button>
              </>
            ) : null}
          </Notice>
        ) : null}
        {resend?.message ? <Notice tone="ok">{resend.message}</Notice> : null}
        {resend?.error ? <Notice tone="danger">{resend.error}</Notice> : null}
        <Submit pending={pending}>Sign in</Submit>
      </form>
    </>
  );
}

export function SignUpForm({ emailEnabled }: { emailEnabled: boolean }) {
  const params = useSearchParams();
  const [state, action, pending] = React.useActionState<FormState, FormData>(signUpWithPasswordAction, {});
  const srcRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (srcRef.current) srcRef.current.value = readAttribution() ?? "";
  });
  if (state.message) return <Notice tone="ok">{state.message}</Notice>;
  return (
    <>
      <UrlError />
      <GoogleButton next={safeNextPath(params.get("next"))} label="Sign up with Google" />
      <Divider>Or create an account with email</Divider>
      {emailEnabled ? (
        <form action={action} className="space-y-5" noValidate>
          <input ref={srcRef} type="hidden" name="src" defaultValue="" />
          <DarkField
            name="email"
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
            hint="Use the address your invite was sent to."
          />
          <DarkField name="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 10 characters" error={state.fieldErrors?.password} />
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <Submit pending={pending}>Create account</Submit>
        </form>
      ) : (
        <Notice tone="warn">Email sign-up isn&apos;t available yet. Continue with Google above.</Notice>
      )}
      <p className="mt-5 text-center text-[14px] text-fog">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-mint hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = React.useActionState<FormState, FormData>(forgotPasswordAction, {});
  if (state.message) return <Notice tone="ok">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <DarkField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@company.com" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <Submit pending={pending}>Send reset link</Submit>
      <p className="text-center text-[14px] text-fog">
        Signed up with Google?{" "}
        <Link href="/sign-in" className="font-medium text-mint hover:underline">
          Use Sign in with Google
        </Link>{" "}
        instead.
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = React.useActionState<FormState, FormData>(resetPasswordAction, {});
  if (!token)
    return (
      <Notice tone="warn">
        This page needs the link from your reset email.{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          Request a new link
        </Link>
      </Notice>
    );
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <DarkField name="password" label="New password" type="password" autoComplete="new-password" placeholder="At least 10 characters" error={state.fieldErrors?.password} />
      <DarkField name="confirm" label="Confirm new password" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
      {state.error ? (
        <Notice tone="danger">
          {state.error}{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </Notice>
      ) : null}
      <Submit pending={pending}>Set new password</Submit>
    </form>
  );
}
