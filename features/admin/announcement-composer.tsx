"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Send, Square, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { renderAnnouncement, type AnnouncementTemplate } from "@/lib/announcements";
import { continueAnnouncementAction, sendAnnouncementTestAction, startAnnouncementAction, stopAnnouncementAction } from "@/server/actions/admin";
import { cn } from "@/lib/utils";

type Props = { templates: AnnouncementTemplate[]; recipients: number; optOuts: number; canSend: boolean; site: string; trialDays: number; paused?: { id: string; subject: string }[] };

export function AnnouncementComposer({ templates, recipients, optOuts, canSend, site, trialDays, paused = [] }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState<string | null>(templates[0]?.id ?? null);
  const [subject, setSubject] = React.useState(templates[0]?.subject ?? "");
  const [body, setBody] = React.useState(templates[0]?.body ?? "");
  const [preview, setPreview] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [status, setStatus] = React.useState<{ tone: "green" | "danger" | "info" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = React.useState<null | "test" | "send">(null);
  const [progress, setProgress] = React.useState<{ id: string; sent: number; failed: number; total: number } | null>(null);
  const stopRef = React.useRef(false);

  const pick = (t: AnnouncementTemplate) => {
    setTemplateId(t.id);
    setSubject(t.subject);
    setBody(t.body);
    setStatus(null);
  };
  const vars = { first_name: "Sam", site, trial_days: trialDays };

  const test = async () => {
    setBusy("test");
    setStatus(null);
    const r = await sendAnnouncementTestAction({ template: templateId, subject, body });
    setBusy(null);
    setStatus(r.ok ? { tone: "green", text: `Test sent to ${r.to}. Check how it looks (and the Spam folder) before sending to everyone.` } : { tone: "danger", text: r.error });
  };

  /** Sends batch after batch until done, stopped, or the mailbox refuses (then it can be resumed later). */
  const run = async (id: string, total: number) => {
    stopRef.current = false;
    let sent = 0;
    let failed = 0;
    setProgress({ id, sent, failed, total });
    for (;;) {
      if (stopRef.current) {
        await stopAnnouncementAction(id);
        setStatus({ tone: "info", text: `Stopped after ${sent} email${sent === 1 ? "" : "s"}.` });
        break;
      }
      const r = await continueAnnouncementAction(id);
      if (!r.ok) {
        setStatus({ tone: "danger", text: r.error });
        break;
      }
      sent += r.sent;
      failed += r.failed;
      setProgress({ id, sent, failed, total });
      if (r.done) {
        setStatus({ tone: "green", text: `Done: sent to ${sent} ${sent === 1 ? "person" : "people"}${failed ? `, ${failed} failed` : ""}.` });
        break;
      }
      if (r.note) {
        setStatus({ tone: "warn", text: `Paused with ${r.remaining} left: ${r.note} Resume it from this page later (nobody gets it twice).` });
        break;
      }
    }
    setProgress(null);
    setBusy(null);
    router.refresh();
  };

  const send = async () => {
    setBusy("send");
    setStatus(null);
    const r = await startAnnouncementAction({ template: templateId, subject, body, confirm });
    if (!r.ok) {
      setBusy(null);
      setStatus({ tone: "danger", text: r.error });
      return;
    }
    setConfirm(false);
    await run(r.id, r.total);
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-ink">New announcement</h2>
        <p className="text-sm text-slate">
          Goes to <span className="font-semibold tabular-nums text-ink">{recipients}</span> registered {recipients === 1 ? "person" : "people"} with a confirmed email
          {optOuts ? ` (${optOuts} unsubscribed, left out)` : ""}.
        </p>
      </div>

      {paused.length ? (
        <div className="mt-4 space-y-2">
          {paused.map((p) => (
            <Callout key={p.id} tone="warn" className="flex flex-wrap items-center justify-between gap-2">
              <span>
                “{p.subject}” was paused before everyone got it.
              </span>
              <Button size="sm" variant="secondary" disabled={!!busy || !canSend} onClick={() => (setBusy("send"), run(p.id, recipients))}>
                Resume sending
              </Button>
            </Callout>
          ))}
        </div>
      ) : null}

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate">Start from</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t)}
            aria-pressed={templateId === t.id}
            className={cn("rounded-xl border p-3 text-left transition-colors", templateId === t.id ? "border-green bg-mint-soft/40" : "border-line hover:border-green/40")}
          >
            <span className="block text-sm font-semibold text-ink">{t.label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate">{t.summary}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ann-subject">Subject</Label>
          <Input id="ann-subject" value={subject} onChange={(e) => (setSubject(e.target.value), setTemplateId(null))} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ann-body">Email</Label>
            <button type="button" onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-green hover:underline">
              <Eye aria-hidden className="size-3.5" /> {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div className="rounded-xl border border-line bg-canvas p-4">
              <p className="text-sm font-semibold text-ink">{renderAnnouncement(subject, vars)}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{renderAnnouncement(body, vars)}</pre>
            </div>
          ) : (
            <Textarea id="ann-body" value={body} onChange={(e) => (setBody(e.target.value), setTemplateId(null))} rows={16} className="font-mono text-[13px] leading-6" />
          )}
          <p className="text-xs text-slate">
            Plain text. <code className="font-mono">{"{{first_name}}"}</code> becomes each person&apos;s first name (or “there”), <code className="font-mono">{"{{site}}"}</code> the website and{" "}
            <code className="font-mono">{"{{trial_days}}"}</code> the trial length. Mail apps get a one-click unsubscribe with every email; nothing is added to the text.
          </p>
        </div>
      </div>

      {status ? (
        <Callout tone={status.tone} className="mt-4">
          <span role="status">{status.text}</span>
        </Callout>
      ) : null}
      {progress ? (
        <div className="mt-4 space-y-2" role="status">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink">
              Sending… <span className="tabular-nums">{progress.sent}</span> of <span className="tabular-nums">{progress.total}</span>
              {progress.failed ? <span className="text-danger-fg"> · {progress.failed} failed</span> : null}
            </span>
            <Button size="sm" variant="ghost" onClick={() => (stopRef.current = true)}>
              <Square aria-hidden /> Stop
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-green transition-all" style={{ width: `${progress.total ? Math.min(100, Math.round(((progress.sent + progress.failed) / progress.total) * 100)) : 0}%` }} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button variant="secondary" onClick={test} disabled={!!busy || !canSend || !subject.trim() || !body.trim()}>
          {busy === "test" ? <Loader2 aria-hidden className="animate-spin" /> : <TestTube2 aria-hidden />} Send a test to me
        </Button>
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={!!busy} />I sent myself a test and it looks right
        </label>
        <Button onClick={send} disabled={!!busy || !canSend || !confirm || !recipients || !subject.trim() || !body.trim()}>
          {busy === "send" ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send to {recipients} {recipients === 1 ? "person" : "people"}
        </Button>
      </div>
    </section>
  );
}
