"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { authErrorMessage, firebaseAuth } from "@/lib/firebase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { checkInviteAction } from "@/server/actions/auth";

type Status = { tone: "danger" | "green" | "warn"; text: string; resend?: boolean } | null;

const SESSION_ERRORS: Record<string, string> = {
  not_invited: "This email isn't on the private-beta list yet. Use the address your invite was sent to.",
  email_not_verified: "Confirm your email first. We sent a link when you created the account.",
  stale_sign_in: "That sign-in took too long. Please try again.",
  no_email: "Your account needs an email address.",
  not_configured: "Accounts aren't configured in this environment yet.",
};

/** Exchange the fresh Firebase sign-in for the server session cookie. */
async function createSession(user: User): Promise<string | null> {
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "unknown";
}

function Field({ name, label, type = "text", autoComplete, value, onChange, error, hint }: {
  name: string; label: string; type?: string; autoComplete?: string; value: string; onChange: (v: string) => void; error?: string; hint?: string;
}) {
  const d = error || hint ? `f-${name}-d` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input id={`f-${name}`} name={name} type={type} autoComplete={autoComplete} required value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={d} />
      {error ? <FieldError id={d}>{error}</FieldError> : hint ? <FieldHint id={d}>{hint}</FieldHint> : null}
    </div>
  );
}

function StatusBox({ status, onResend }: { status: Status; onResend?: () => void }) {
  if (!status) return null;
  return (
    <Callout tone={status.tone}>
      <span role={status.tone === "danger" ? "alert" : "status"}>{status.text}</span>
      {status.resend && onResend ? (
        <button type="button" onClick={onResend} className="ml-1 font-semibold underline">
          Resend the link
        </button>
      ) : null}
    </Callout>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-4">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(params.get("verified") ? { tone: "green", text: "Email confirmed. You can sign in now." } : null);
  const unverifiedUser = React.useRef<User | null>(null);
  const next = safeNextPath(params.get("next"));

  const finish = async (user: User) => {
    const err = await createSession(user);
    if (err === "email_not_verified") unverifiedUser.current = user;
    else await signOut(await firebaseAuth());
    if (err) {
      setStatus({ tone: err === "not_invited" ? "warn" : "danger", text: SESSION_ERRORS[err] ?? "Couldn't sign you in. Please try again.", resend: err === "email_not_verified" });
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus({ tone: "danger", text: authErrorMessage(e) });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button type="button" variant="secondary" className="w-full" disabled={pending} onClick={() => run(async () => finish((await signInWithPopup(await firebaseAuth(), new GoogleAuthProvider())).user))}>
        <GoogleIcon /> Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-slate">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim() || !password) return setStatus({ tone: "danger", text: "Enter your email and password." });
          void run(async () => finish((await signInWithEmailAndPassword(await firebaseAuth(), email.trim(), password)).user));
        }}
      >
        <Field name="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
        <Field name="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        <StatusBox
          status={status}
          onResend={async () => {
            if (!unverifiedUser.current) return;
            await sendEmailVerification(unverifiedUser.current, { url: `${window.location.origin}/sign-in?verified=1` }).catch(() => undefined);
            setStatus({ tone: "green", text: "A new confirmation link is on its way." });
          }}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="font-medium text-green hover:underline">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="font-medium text-green hover:underline">
          Have an invite? Create an account
        </Link>
      </div>
    </div>
  );
}

export function SignUpForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<Status>(null);
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (done) return <StatusBox status={{ tone: "green", text: "Check your inbox for a confirmation link, then sign in." }} />;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (name.trim().length < 2) errs.fullName = "Add your name.";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
        if (password.length < 10) errs.password = "Use at least 10 characters.";
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setPending(true);
        setStatus(null);
        try {
          const { allowed } = await checkInviteAction(email);
          if (!allowed) {
            setStatus({ tone: "warn", text: SESSION_ERRORS.not_invited });
            return;
          }
          const auth = await firebaseAuth();
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          await updateProfile(cred.user, { displayName: name.trim() });
          await sendEmailVerification(cred.user, { url: `${window.location.origin}/sign-in?verified=1` });
          await signOut(auth);
          setDone(true);
        } catch (err) {
          setStatus({ tone: "danger", text: authErrorMessage(err) });
        } finally {
          setPending(false);
        }
      }}
    >
      <Field name="fullName" label="Your name" autoComplete="name" value={name} onChange={setName} error={errors.fullName} />
      <Field name="email" label="Work email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email} hint="Use the address your beta invite was sent to." />
      <Field name="password" label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="At least 10 characters." />
      <StatusBox status={status} />
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
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<Status>(null);
  const [pending, setPending] = React.useState(false);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setStatus({ tone: "danger", text: "Enter a valid email address." });
        setPending(true);
        try {
          await sendPasswordResetEmail(await firebaseAuth(), email.trim(), { url: `${window.location.origin}/sign-in` });
        } catch {
          // Same message either way, so the form can't reveal which emails have accounts.
        } finally {
          setPending(false);
          setStatus({ tone: "green", text: "If an account exists for that address, a reset link is on its way." });
        }
      }}
    >
      <Field name="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
      <StatusBox status={status} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
