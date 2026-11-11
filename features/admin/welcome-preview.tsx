"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendWelcomeTestAction } from "@/server/actions/admin";

/** Admin → Announcements: the automatic welcome email, with a button to send it to yourself. */
export function WelcomePreview() {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="card flex flex-wrap items-center gap-4 p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
        <Sparkles aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold text-ink">Welcome email (automatic)</h2>
        <p className="text-sm text-slate">Sent once to every new account: when an email sign-up is confirmed, or on the first Google sign-in. Designed HTML with a plain-text version.</p>
        {msg ? <p className={`mt-1 text-sm ${msg.ok ? "text-green" : "text-danger-fg"}`} role="status">{msg.text}</p> : null}
      </div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendWelcomeTestAction();
            setMsg(r.ok ? { ok: true, text: `Sent to ${r.to}.` } : { ok: false, text: r.error });
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : null} Send me the welcome email
      </Button>
    </section>
  );
}
