"use client";

import { writeDraftAction } from "@/server/actions/ai";
import { findMissingLeadEmailsAction } from "@/server/actions/emails";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2, Mail, MailCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/field";
import { checkEmailAction, researchLeadAction, saveNotesAction } from "@/server/actions/research";

export function ResearchButton({ leadId, researched }: { leadId: string; researched: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "green" | "danger" | "warn"; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        variant={researched ? "secondary" : "primary"}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await researchLeadAction(leadId);
            if (!r.ok) setMsg({ tone: "danger", text: r.error });
            else {
              setMsg({ tone: r.status === "ok" ? "green" : "warn", text: r.note });
              router.refresh();
            }
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <FileSearch aria-hidden />}
        {pending ? "Reading the website…" : researched ? "Research again" : "Research website"}
      </Button>
      {pending ? <p className="text-xs text-slate">Reads up to 3 public pages, respecting robots.txt. Takes up to 20 seconds.</p> : null}
      {msg ? (
        <Callout tone={msg.tone} className="py-2">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}
    </div>
  );
}

export function CheckEmailButton({ contactId, leadId }: { contactId: string; leadId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await checkEmailAction(contactId, leadId);
            if (!r.ok) setError(r.error);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <MailCheck aria-hidden />} Check email
      </Button>
      {error ? <span role="alert" className="text-xs text-danger-fg">{error}</span> : null}
    </span>
  );
}

export function NotesEditor({ leadId, initial }: { leadId: string; initial: string }) {
  const [value, setValue] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [status, setStatus] = React.useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <label htmlFor="lead-notes" className="text-[13px] font-semibold text-ink">
        Notes
      </label>
      <Textarea
        id="lead-notes"
        rows={4}
        value={value}
        maxLength={5000}
        placeholder="Anything worth remembering. Private to your workspace."
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value === saved) return;
          const r = await saveNotesAction(leadId, value);
          if (r.ok) {
            setSaved(value);
            setStatus("Saved.");
          } else setStatus(r.error);
        }}
      />
      <p className="text-xs text-slate" aria-live="polite">
        {value !== saved ? "Saves when you leave the field." : status ?? ""}
      </p>
    </div>
  );
}

/** Writes (or rewrites) this lead's first email with the built-in AI. */
export function WriteWithAiButton({ leadId, hasDraft, disabledReason }: { leadId: string; hasDraft: boolean; disabledReason: string | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "green" | "danger"; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant={hasDraft ? "secondary" : "primary"}
        disabled={pending || !!disabledReason}
        title={disabledReason ?? undefined}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await writeDraftAction(leadId);
            setMsg(r.ok ? { tone: "green", text: "Draft written. Read it before using it in a campaign." } : { tone: "danger", text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
        {pending ? "Writing…" : hasDraft ? "Rewrite with AI" : "Write with AI"}
      </Button>
      {disabledReason ? <p className="text-xs text-slate">{disabledReason}</p> : null}
      {msg ? (
        <Callout tone={msg.tone} className="py-2">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}
    </div>
  );
}

/** Reads saved leads' websites for public emails they don't have yet (15 per click). */
export function FindEmailsButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "green" | "danger" | "info"; text: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await findMissingLeadEmailsAction();
            if (!r.ok) setMsg({ tone: "danger", text: r.error });
            else if (!r.checked) setMsg({ tone: "info", text: "Every lead with a website already has an email, or was checked recently." });
            else setMsg({ tone: r.found ? "green" : "info", text: `Checked ${r.checked} website${r.checked === 1 ? "" : "s"}: found emails for ${r.found}.${r.remaining ? " Click again for more." : ""}` });
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />} {pending ? "Reading websites…" : "Find missing emails"}
      </Button>
      {msg ? (
        <Callout tone={msg.tone} className="py-1.5">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}
    </div>
  );
}
