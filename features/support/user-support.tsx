"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { openSupportAction, replySupportAction, resolveSupportAction } from "@/server/actions/support";

/** New support request form. */
export function NewRequestForm({ topics }: { topics: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [topic, setTopic] = React.useState("other");
  const [urgent, setUrgent] = React.useState(false);
  const [body, setBody] = React.useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await openSupportAction({ subject, topic, urgent, body });
          if (r.ok) router.push(`/app/support/${r.id}`);
          else setError(r.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="sup-subject">Subject</Label>
          <Input id="sup-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. My mailbox says it needs reconnecting" maxLength={200} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sup-topic">Topic</Label>
          <Select id="sup-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sup-body">How can we help?</Label>
        <Textarea id="sup-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="What happened, what you expected, and any error message you saw." maxLength={10000} required />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <Checkbox checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
        It&apos;s urgent: something is broken and I can&apos;t work
      </label>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Button type="submit" disabled={pending || subject.trim().length < 3 || body.trim().length < 2}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send to support
      </Button>
    </form>
  );
}

/** Reply box and "Mark as solved" on a request. */
export function ReplyBox({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={resolved ? "Write to reopen this request…" : "Write a reply…"} aria-label="Your reply" maxLength={10000} />
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending || body.trim().length < 2}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await replySupportAction(id, body);
              if (r.ok) {
                setBody("");
                router.refresh();
              } else setError(r.error);
            })
          }
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send reply
        </Button>
        {!resolved ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await resolveSupportAction(id);
                router.refresh();
              })
            }
          >
            <CheckCircle2 aria-hidden /> Mark as solved
          </Button>
        ) : null}
        <Link href="/app/support" className="ml-auto text-sm font-medium">
          All requests
        </Link>
      </div>
    </div>
  );
}
