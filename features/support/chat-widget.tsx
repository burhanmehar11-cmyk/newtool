"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, MessageCircle, Send, UserRound, X, Zap } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { askVisitorHelpAction, contactTeamFromSiteAction, openSupportAction } from "@/server/actions/support";
import { HELP_STARTERS, useHelpChat } from "@/features/support/use-help-chat";
import type { InstantAnswer } from "@/lib/help-answers";

const SITE_STARTERS = ["What does Locenti do?", "How does the free trial work?", "Does it send from my own Gmail?", "Where do the emails come from?"];

/**
 * The chat bubble in the corner of every app page (and, with `site`, the
 * public website): the AI assistant first, and "Talk to the team" as the
 * last step. In the app that becomes a support request with a ticket number;
 * on the website it emails the team, who reply to the visitor's address.
 * The conversation stays as people move between pages.
 */
export function ChatWidget({ assistant, site = false, instant = [] }: { assistant: boolean; site?: boolean; instant?: InstantAnswer[] }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"chat" | "team" | "sent">(assistant ? "chat" : "team");
  const [sent, setSent] = React.useState<{ id: string; ref: string } | { email: string } | null>(null);
  const chat = useHelpChat(site ? askVisitorHelpAction : undefined, instant);
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
          <div className="relative shrink-0 overflow-hidden bg-midnight px-5 pb-4 pt-4 text-white sm:pb-5">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,rgb(143_240_192/0.07)_0_10px,transparent_10px_20px)]" />
            <div className="relative flex items-center justify-between">
              {view === "chat" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
                  <LogoMark className="size-3.5" /> AI assistant
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
                  <span className="relative flex size-12 items-center justify-center rounded-full border-2 border-midnight bg-mint text-midnight">
                    <LogoMark className="size-6" />
                    <span aria-hidden className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-midnight bg-green" />
                  </span>
                  <p className="mt-3 font-display text-lg font-bold">Locenti AI Assistant</p>
                  <p className="mt-1 text-xs text-white/70">{site ? "Instant answers about Locenti, any time." : "Instant answers about anything in Locenti, any time."}</p>
                  {/* The people are the team, not the AI: shown apart, with their own way in. */}
                  <button
                    type="button"
                    onClick={() => setView("team")}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-xs font-semibold text-white transition-colors hover:border-mint/40 hover:bg-white/10"
                  >
                    <span className="flex -space-x-1.5">
                      <TeamFaces size={24} ring="border-midnight" />
                    </span>
                    Prefer a person? Talk to the team <ArrowRight aria-hidden className="size-3.5 text-mint" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center -space-x-2.5">
                    <TeamFaces size={48} ring="border-midnight" />
                  </div>
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
              <div ref={listRef} className="min-h-[140px] flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                <Bubble role="assistant">
                  {site
                    ? "Hi! I'm Locenti's AI assistant. Ask me what Locenti does, how it finds businesses and emails, or how the free trial works."
                    : "Hi! I'm Locenti's AI assistant. Ask me anything about finding businesses, writing emails, mailboxes or campaigns, and I'll answer right away."}
                </Bubble>
                {chat.msgs.length === 0 ? (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {(site ? SITE_STARTERS : HELP_STARTERS).map((s) => (
                      <button key={s} type="button" onClick={() => chat.ask(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-green/50 hover:bg-mint-soft/40">
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
                {chat.msgs.map((m, i) => (
                  <Bubble key={i} role={m.role}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.link && !site ? (
                      <Link href={m.link.href} onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green hover:underline">
                        {m.link.label} <ArrowRight aria-hidden className="size-3" />
                      </Link>
                    ) : null}
                    {m.instant ? (
                      <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate">
                        <span className="inline-flex items-center gap-1">
                          <Zap aria-hidden className="size-3 text-green" /> Instant answer
                        </span>
                        {!m.instant.retried ? (
                          <button type="button" onClick={() => chat.retryWithAI(i)} disabled={chat.pending} className="font-semibold text-green hover:underline disabled:opacity-50">
                            Not quite? Ask the AI
                          </button>
                        ) : null}
                      </span>
                    ) : null}
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
                    <div className="flex items-center gap-2">
                      <span className="flex -space-x-1.5">
                        <TeamFaces size={22} ring="border-surface" />
                      </span>
                      <p className="text-xs font-semibold text-ink">{chat.lastSuggest ? "This one needs a person" : site ? "Still have questions?" : "Still need help?"}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate">{site ? "Try Locenti free, no card needed, or message our team. We reply within a day." : "Our team replies, usually within a day. Your chat is included."}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {site ? (
                        <Button asChild size="sm">
                          <Link href="/sign-up">
                            Start free trial <ArrowRight aria-hidden />
                          </Link>
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="secondary" onClick={() => setView("team")}>
                        <UserRound aria-hidden /> Talk to the team
                      </Button>
                    </div>
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
          ) : view === "team" && site ? (
            <SiteTeamForm
              transcript={chat.transcript()}
              onSent={(email) => {
                setSent({ email });
                setView("sent");
              }}
            />
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
              {sent && "email" in sent ? (
                <>
                  <p className="font-display text-lg font-semibold text-ink">Thanks, message sent</p>
                  <p className="text-sm leading-6 text-slate">
                    Someone from our team will reply to <span className="font-medium text-ink">{sent.email}</span>, usually within a day.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold text-ink">We&apos;ve got it{sent ? `: ${sent.ref}` : ""}</p>
                  <p className="text-sm leading-6 text-slate">We emailed you a confirmation. Someone from our team will get back to you soon, usually within a day, by email and in Help &amp; Support.</p>
                </>
              )}
              {sent && "id" in sent ? (
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
        className={cn(
          "fixed bottom-6 right-4 z-40 flex size-14 items-center justify-center rounded-full shadow-[0_12px_32px_-8px_rgb(5_12_18/0.55)] ring-4 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-mint sm:right-6",
          // Mint on the dark website so it stands out; dark in the light app.
          site ? "bg-mint text-midnight ring-mint/25" : "bg-midnight text-mint ring-mint/25",
        )}
      >
        {open ? <X aria-hidden className="size-6" /> : <MessageCircle aria-hidden className="size-6" />}
        {!open && assistant ? <span aria-hidden className={cn("absolute right-0.5 top-0.5 size-3 rounded-full border-2", site ? "border-mint bg-green" : "border-midnight bg-mint")} /> : null}
      </button>
    </>
  );
}

/** Friendly faces for "the team" (photos in /public/team). */
const FACES = ["/team/face-1.webp", "/team/face-2.webp", "/team/face-3.webp"];
function TeamFaces({ size, ring }: { size: number; ring: string }) {
  return (
    <>
      {FACES.map((src) => (
        <Image key={src} src={src} alt="" aria-hidden width={size} height={size} className={cn("shrink-0 rounded-full border-2 object-cover", ring)} style={{ width: size, height: size }} />
      ))}
    </>
  );
}

function Avatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-midnight text-mint">
      <LogoMark className="size-4" />
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

function SiteTeamForm({ transcript, onSent }: { transcript: string; onSent: (email: string) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState(transcript ? `${transcript}\n\n` : "");
  const [website, setWebsite] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await contactTeamFromSiteAction({ name, email, message, website });
          if (r.ok) onSent(email.trim());
          else setError(r.error);
        });
      }}
    >
      <p className="text-sm text-slate">Leave your email and a short message. A real person replies, usually within a day.</p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" aria-label="Your name" maxLength={100} autoComplete="name" />
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" aria-label="Your email" maxLength={254} autoComplete="email" required />
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="How can we help?" aria-label="Message" maxLength={5000} required />
      {/* Spam trap, hidden from people. */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
      {transcript ? <p className="text-[11px] text-slate">Your chat with the assistant is included.</p> : null}
      {error ? <p className="rounded-xl bg-danger-bg px-3 py-2 text-xs text-danger-fg">{error}</p> : null}
      <Button type="submit" disabled={pending || !email.trim() || message.trim().length < 2}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send to the team
      </Button>
    </form>
  );
}
