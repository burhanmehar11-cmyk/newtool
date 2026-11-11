"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock, Loader2, MessageCircle, Send, Sparkles, UserRound, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { openSupportAction } from "@/server/actions/support";
import { HELP_STARTERS, useHelpChat } from "@/features/support/use-help-chat";

/**
 * The chat bubble in the corner of every app page: the AI help assistant, and
 * "Talk to the team", which turns the chat into a support request without
 * leaving the page. The conversation stays as people move between pages.
 */
export function ChatWidget({ assistant }: { assistant: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"chat" | "team" | "sent">(assistant ? "chat" : "team");
  const [sent, setSent] = React.useState<{ id: string; ref: string } | null>(null);
  const chat = useHelpChat();
  const [text, setText] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const aiView = assistant && view === "chat";
  const answered = chat.msgs.some((m) => m.role === "assistant");

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.msgs.length, chat.pending, view]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-label="Help chat"
          className="fixed inset-x-3 bottom-24 z-40 flex max-h-[min(640px,calc(100dvh-120px))] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_70px_-20px_rgb(5_12_18/0.45)] sm:inset-x-auto sm:right-6 sm:w-[390px] origin-bottom-right animate-[chat-in_200ms_var(--ease-out-soft)] motion-reduce:animate-none"
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-midnight px-5 pb-5 pt-4 text-white">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,rgb(143_240_192/0.07)_0_10px,transparent_10px_20px)]" />
            <div className="relative flex items-center justify-between">
              {view === "chat" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
                  <Sparkles aria-hidden className="size-3.5" /> AI assistant
                </span>
              ) : (
                <button type="button" onClick={() => setView(assistant ? "chat" : "team")} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white/70 hover:text-white" disabled={!assistant}>
                  {assistant ? (
                    <>
                      <ArrowLeft aria-hidden className="size-3.5" /> Back to chat
                    </>
                  ) : (
                    "Help & Support"
                  )}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close chat">
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <div className="relative mt-4 flex flex-col items-center text-center">
              {aiView ? (
                <>
                  <span className="relative flex size-12 items-center justify-center rounded-full bg-mint text-midnight shadow-[0_0_0_6px_rgb(143_240_192/0.12)]">
                    <Sparkles aria-hidden className="size-6" />
                    <span aria-hidden className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-midnight bg-green" />
                  </span>
                  <p className="mt-3 font-display text-lg font-bold">Locenti AI Assistant</p>
                  <p className="mt-1 text-xs text-white/70">Instant answers about anything in Locenti, any time.</p>
                </>
              ) : (
                <>
                  <span className="flex size-12 items-center justify-center rounded-full bg-midnight-2 text-mint ring-1 ring-mint/30">
                    <LogoMark className="size-6" />
                  </span>
                  <p className="mt-3 font-display text-lg font-bold">Talk to the team</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/70">
                    <Clock aria-hidden className="size-3.5 text-mint" /> A real person replies, usually within a day
                  </p>
                </>
              )}
            </div>
          </div>

          {view === "chat" ? (
            <>
              <div ref={listRef} className="min-h-[240px] flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                <Bubble role="assistant">Hi! I&apos;m Locenti&apos;s AI assistant. Ask me anything about finding businesses, writing emails, mailboxes or campaigns, and I&apos;ll answer right away.</Bubble>
                {chat.msgs.length === 0 ? (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {HELP_STARTERS.map((s) => (
                      <button key={s} type="button" onClick={() => chat.ask(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-green/50 hover:bg-mint-soft/40">
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
                {chat.msgs.map((m, i) => (
                  <Bubble key={i} role={m.role}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </Bubble>
                ))}
                {chat.pending ? (
                  <div className="flex items-center gap-2 pl-1">
                    <Avatar />
                    <span className="inline-flex gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3" aria-label="Thinking">
                      <span className="size-1.5 animate-bounce rounded-full bg-slate [animation-delay:-0.2s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-slate [animation-delay:-0.1s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-slate" />
                    </span>
                  </div>
                ) : null}
                {chat.error ? <p className="rounded-xl bg-warn-bg px-3 py-2 text-xs text-warn-fg">{chat.error}</p> : null}
                {/* The team is the last step: offered once the assistant has had a go. */}
                {!chat.pending && (answered || chat.error) ? (
                  <div className={cn("ml-9 rounded-2xl border p-3", chat.lastSuggest || chat.error ? "border-green/40 bg-mint-soft/40" : "border-line bg-surface")}>
                    <p className="text-xs font-semibold text-ink">{chat.lastSuggest ? "This one needs a person" : "Still need help?"}</p>
                    <p className="mt-0.5 text-xs text-slate">Our team replies, usually within a day. Your chat is included.</p>
                    <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setView("team")}>
                      <UserRound aria-hidden /> Talk to the team
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-line p-3">
                <form
                  className="flex items-end gap-2 rounded-2xl border border-line bg-canvas/60 p-1.5 focus-within:border-green focus-within:ring-2 focus-within:ring-green/20"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chat.ask(text)) setText("");
                  }}
                >
                  <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Compose your message…" aria-label="Your message" maxLength={2000} className="h-9 border-0 bg-transparent shadow-none focus-visible:outline-none" />
                  <Button type="submit" size="icon-sm" disabled={chat.pending || !text.trim()} aria-label="Send">
                    {chat.pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
                  </Button>
                </form>
                <p className="mt-2 px-1 text-center text-[11px] text-slate">AI can make mistakes. Check important details.</p>
              </div>
            </>
          ) : view === "team" ? (
            <TeamForm
              initialSubject={chat.lastSuggest?.subject || chat.firstQuestion.slice(0, 120)}
              initialTopic={chat.lastSuggest?.topic ?? "other"}
              transcript={chat.transcript()}
              onSent={(r) => {
                setSent(r);
                setView("sent");
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <CheckCircle2 aria-hidden className="size-10 text-green" />
              <p className="font-display text-lg font-semibold text-ink">We&apos;ve got it{sent ? `: ${sent.ref}` : ""}</p>
              <p className="text-sm leading-6 text-slate">We emailed you a confirmation. Someone from our team will get back to you soon, usually within a day, by email and in Help &amp; Support.</p>
              {sent ? (
                <Button asChild size="sm" variant="secondary" onClick={() => setOpen(false)}>
                  <Link href={`/app/support/${sent.id}`}>
                    Open {sent.ref} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
              <button
                type="button"
                className="text-xs font-medium text-green hover:underline"
                onClick={() => {
                  chat.reset();
                  setSent(null);
                  setView(assistant ? "chat" : "team");
                }}
              >
                Start a new conversation
              </button>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 120);
        }}
        aria-label={open ? "Close help chat" : "Open help chat"}
        aria-expanded={open}
        className="fixed bottom-6 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-midnight text-mint shadow-[0_12px_32px_-8px_rgb(5_12_18/0.55)] ring-4 ring-mint/25 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-mint sm:right-6"
      >
        {open ? <X aria-hidden className="size-6" /> : <MessageCircle aria-hidden className="size-6" />}
        {!open && assistant ? <span aria-hidden className="absolute right-0.5 top-0.5 size-3 rounded-full border-2 border-midnight bg-mint" /> : null}
      </button>
    </>
  );
}

function Avatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-midnight text-mint">
      <Bot aria-hidden className="size-4" />
    </span>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2", role === "user" && "justify-end")}>
      {role === "assistant" ? <Avatar /> : null}
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6", role === "user" ? "rounded-br-md bg-green text-white" : "rounded-bl-md border border-line bg-canvas/60 text-ink")}>{children}</div>
    </div>
  );
}

function TeamForm({ initialSubject, initialTopic, transcript, onSent }: { initialSubject: string; initialTopic: string; transcript: string; onSent: (r: { id: string; ref: string }) => void }) {
  const [subject, setSubject] = React.useState(initialSubject);
  const [body, setBody] = React.useState(transcript ? `${transcript}\n\n` : "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await openSupportAction({ subject, topic: initialTopic, urgent: false, body });
          if (r.ok) onSent({ id: r.id, ref: r.ref });
          else setError(r.error);
        });
      }}
    >
      <p className="text-sm text-slate">Tell us what&apos;s going on. A real person replies, usually within a day, and you get a ticket number right away.</p>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={200} required />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="What happened, and what you expected" aria-label="Message" maxLength={10000} required />
      {transcript ? <p className="text-[11px] text-slate">Your chat with the assistant is included so you don&apos;t have to repeat yourself.</p> : null}
      {error ? <p className="rounded-xl bg-danger-bg px-3 py-2 text-xs text-danger-fg">{error}</p> : null}
      <Button type="submit" disabled={pending || subject.trim().length < 3 || body.trim().length < 2}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send to the team
      </Button>
    </form>
  );
}
