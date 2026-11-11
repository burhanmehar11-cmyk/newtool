"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Bot, Bug, Check, CreditCard, Loader2, Mail, PauseCircle, PenLine, Search, Send, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { QuickPick } from "@/lib/help-content";
import { openSupportAction } from "@/server/actions/support";
import { HELP_STARTERS, useHelpChat } from "@/features/support/use-help-chat";

const ICONS = { mail: Mail, pause: PauseCircle, search: Search, pen: PenLine, users: Users, card: CreditCard, ban: Ban, bug: Bug } as const;
type Draft = { subject: string; topic: string; body: string };


export function HelpCenter({ picks, topics, assistant, ready }: { picks: QuickPick[]; topics: { id: string; label: string }[]; assistant: boolean; ready: boolean }) {
  const [draft, setDraft] = React.useState<Draft>({ subject: "", topic: "other", body: "" });
  const [draftKey, setDraftKey] = React.useState(0);
  const formRef = React.useRef<HTMLDivElement>(null);
  /** Fills the request form and brings it into view. */
  const prefill = (d: Draft) => {
    setDraft(d);
    setDraftKey((k) => k + 1);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <div className="space-y-6">
      <QuickPicks picks={picks} onAsk={(p) => prefill({ subject: p.subject, topic: p.topic, body: p.body })} />
      {/* Without the AI set up, the request form takes the full width. */}
      <div className={assistant ? "grid items-start gap-6 xl:grid-cols-2" : ""}>
        {assistant ? <Assistant onSend={prefill} /> : null}
        <div ref={formRef} className="scroll-mt-6">
          <RequestForm key={draftKey} initial={draft} topics={topics} ready={ready} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Quick picks */

function QuickPicks({ picks, onAsk }: { picks: QuickPick[]; onAsk: (p: QuickPick) => void }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [solved, setSolved] = React.useState<string | null>(null);
  const pick = picks.find((p) => p.id === open) ?? null;
  return (
    <section aria-labelledby="qp-title" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="qp-title" className="font-display text-lg font-semibold text-ink">
          Quick picks
        </h2>
        <p className="text-sm text-slate">The questions we get most, answered in seconds.</p>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((p) => {
          const Icon = ICONS[p.icon];
          const on = open === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-expanded={on}
              onClick={() => (setOpen(on ? null : p.id), setSolved(null))}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200",
                on ? "border-green bg-mint-soft/50 shadow-sm" : "border-line bg-surface hover:-translate-y-0.5 hover:border-green/40 hover:shadow-sm",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors", on ? "bg-green text-white" : "bg-mint-soft text-green group-hover:bg-green group-hover:text-white")}>
                <Icon aria-hidden className="size-[18px]" />
              </span>
              <span className="pt-1 text-sm font-medium leading-5 text-ink">{p.title}</span>
            </button>
          );
        })}
      </div>
      {pick ? (
        <div className="mt-4 rounded-xl border border-green/30 bg-mint-soft/30 p-4 sm:p-5" role="region" aria-label={pick.title}>
          <p className="font-semibold text-ink">{pick.title}</p>
          <ol className="mt-3 space-y-2">
            {pick.answer.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-6 text-ink">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green text-[11px] font-bold text-white">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          {solved === pick.id ? (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-green" role="status">
              <Check aria-hidden className="size-4" /> Glad that helped!
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {pick.link ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={pick.link.href}>
                    {pick.link.label} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setSolved(pick.id)}>
                <Check aria-hidden /> That solved it
              </Button>
              <Button size="sm" onClick={() => onAsk(pick)}>
                Still stuck? Ask the team <ArrowRight aria-hidden />
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------- Assistant */

function Assistant({ onSend }: { onSend: (d: Draft) => void }) {
  const { msgs, pending, error, ask: askChat, transcript } = useHelpChat();
  const [text, setText] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, pending]);
  const ask = (q: string) => {
    if (askChat(q)) setText("");
  };

  return (
    <section aria-labelledby="ai-title" className="card flex min-h-[460px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-mint-soft/60 to-transparent px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-midnight text-mint">
          <Sparkles aria-hidden className="size-5" />
        </span>
        <div>
          <h2 id="ai-title" className="font-display text-base font-semibold text-ink">
            Ask the assistant
          </h2>
          <p className="text-xs text-slate">Instant answers about using Locenti, any time.</p>
        </div>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" style={{ maxHeight: 360 }} aria-live="polite">
        {msgs.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate">Hi! I can explain how anything in Locenti works. Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {HELP_STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-green/50 hover:bg-mint-soft/40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
            {m.role === "assistant" ? (
              <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-midnight text-mint">
                <Bot aria-hidden className="size-4" />
              </span>
            ) : null}
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6", m.role === "user" ? "rounded-br-md bg-green text-white" : "rounded-bl-md border border-line bg-surface text-ink")}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.suggest ? (
                <button type="button" onClick={() => onSend({ subject: m.suggest!.subject || "Question from the assistant", topic: m.suggest!.topic, body: transcript() })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green hover:underline">
                  Send this to the team <ArrowRight aria-hidden className="size-3" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-slate">
            <span className="flex size-7 items-center justify-center rounded-full bg-midnight text-mint">
              <Bot aria-hidden className="size-4" />
            </span>
            <span className="inline-flex gap-1" aria-label="Thinking">
              <span className="size-1.5 animate-bounce rounded-full bg-slate [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate" />
            </span>
          </div>
        ) : null}
        {error ? <Callout tone="warn">{error}</Callout> : null}
      </div>
      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything about Locenti…" aria-label="Your question" maxLength={2000} />
          <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="Ask">
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate">
          AI can make mistakes and can&apos;t see your account. For anything about your account, ask the team.
          {msgs.length > 1 ? (
            <>
              {" "}
              <button type="button" className="font-medium text-green hover:underline" onClick={() => onSend({ subject: "Question from the assistant", topic: "other", body: transcript() })}>
                Send this chat to the team
              </button>
            </>
          ) : null}
        </p>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------ Request form */

function RequestForm({ initial, topics, ready }: { initial: Draft; topics: { id: string; label: string }[]; ready: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState(initial.subject);
  const [topic, setTopic] = React.useState(initial.topic);
  const [urgent, setUrgent] = React.useState(false);
  const [body, setBody] = React.useState(initial.body);
  return (
    <section aria-labelledby="req-title" className="card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-mint-soft text-green">
          <Users aria-hidden className="size-5" />
        </span>
        <div>
          <h2 id="req-title" className="font-display text-base font-semibold text-ink">
            Ask the team
          </h2>
          <p className="text-xs text-slate">A real person replies, usually within a day. You get a ticket number right away.</p>
        </div>
      </div>
      {ready ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await openSupportAction({ subject, topic, urgent, body });
              if (r.ok) router.push(`/app/support/${r.id}?new=1`);
              else setError(r.error);
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="sup-subject">Subject</Label>
              <Input id="sup-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. My campaign won't resume" maxLength={200} required />
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
          <Button type="submit" className="w-full sm:w-auto" disabled={pending || subject.trim().length < 3 || body.trim().length < 2}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send to the team
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate">Requests open soon. Meanwhile, email us at hello@locenti.com.</p>
      )}
    </section>
  );
}
