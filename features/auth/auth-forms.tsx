"use client";

import { useSearchParams } from "next/navigation";
import { Callout } from "@/components/ui/misc";
import { safeNextPath } from "@/lib/safe-redirect";

const ERRORS: Record<string, { tone: "danger" | "warn"; text: string }> = {
  not_invited: { tone: "warn", text: "This Google account isn't on the private-beta list yet. Ask the workspace owner to add your email." },
  cancelled: { tone: "warn", text: "Google sign-in was cancelled." },
  email_not_verified: { tone: "danger", text: "Google says this email isn't verified, so it can't be used to sign in." },
  state: { tone: "danger", text: "That sign-in link expired or was opened in another browser. Please try again." },
  not_configured: { tone: "danger", text: "Sign-in isn't configured in this environment yet." },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-[18px]">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/** "Continue with Google". A plain link, so it works without JavaScript too. */
export function GoogleSignIn() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const err = params.get("error");
  const message = err ? (ERRORS[err] ?? { tone: "danger" as const, text: "Google sign-in didn't complete. Please try again." }) : null;
  return (
    <div className="space-y-4">
      {message ? (
        <Callout tone={message.tone}>
          <span role="alert">{message.text}</span>
        </Callout>
      ) : null}
      <a
        href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-line-strong/60 bg-surface text-[15px] font-medium text-ink transition-colors duration-200 hover:border-line-strong hover:bg-canvas"
      >
        <GoogleIcon /> Continue with Google
      </a>
      <p className="text-center text-xs leading-5 text-slate">
        We only ask Google for your name and email address. Gmail access is requested separately, later, when you choose to connect a mailbox.
      </p>
    </div>
  );
}
