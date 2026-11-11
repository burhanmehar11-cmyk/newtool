"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Flame, Inbox, Keyboard, LifeBuoy, Loader2, Lock, MessageSquare, MessageSquarePlus, RefreshCw, RotateCcw, Search, Send, UserCheck, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/sheet";
import { cn, formatDateTime } from "@/lib/utils";
import { zoneAbbreviation } from "@/lib/admin";
import type { getSupportInbox } from "@/server/services/support";
import { adminFindUsersAction, adminReplySupportAction, adminStartSupportAction, adminUpdateSupportAction } from "@/server/actions/support";

type Data = Awaited<ReturnType<typeof getSupportInbox>>;
type Ticket = Data["list"][number];

const TABS = [
  ["needs_reply", "Needs reply"],
  ["waiting", "Waiting"],
  ["resolved", "Resolved"],
  ["all", "All"],
  ["mine", "Mine"],
] as const;
const STATUS_LABEL = { needs_reply: "Needs reply", waiting: "Waiting on them", resolved: "Resolved" } as const;

/** Times in the admin's time zone (ADMIN_TIMEZONE), the same on the server and in the browser. */
const TzContext = React.createContext("Asia/Karachi");
function useWhen() {
  const tz = React.useContext(TzContext);
  return (iso: string) => `${formatDateTime(iso, tz)} ${zoneAbbreviation(tz, new Date(iso))}`;
}

export function SupportInbox({ data }: { data: Data }) {
  const router = useRouter();
  const f = data.filter;
  const topicLabel = (id: string) => data.topics.find((t) => t.id === id)?.label ?? id;
  /** A URL for the queue with some filters changed. */
  const href = React.useCallback(
    (patch: Partial<{ st: string; q: string; topic: string | null; pri: string | null; ch: string | null; t: string | null }>) => {
      const p = new URLSearchParams({ tab: "support" });
      const v = { st: f.tab, q: f.search, topic: f.topic, pri: f.priority, ch: f.channel, t: data.selected?.ticket.id ?? null, ...patch };
      for (const [k, val] of Object.entries(v)) if (val && !(k === "st" && val === "needs_reply")) p.set(k, String(val));
      return `/admin?${p.toString()}`;
    },
    [f, data.selected],
  );

  const ids = data.list.map((t) => t.id);
  const current = data.selected?.ticket.id ?? null;
  const replyRef = React.useRef<HTMLTextAreaElement>(null);
  const [help, setHelp] = React.useState(false);

  // j / k move through the queue, r replies, ? lists the shortcuts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = current ? ids.indexOf(current) : -1;
      if (e.key === "j" && ids.length) router.push(href({ t: ids[Math.min(ids.length - 1, i + 1)] }));
      else if (e.key === "k" && ids.length) router.push(href({ t: ids[Math.max(0, i - 1)] }));
      else if (e.key === "r" && current) {
        e.preventDefault();
        replyRef.current?.focus();
      } else if (e.key === "?") setHelp((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, current, href, router]);

  return (
    <TzContext.Provider value={data.tz}>
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Top bar: counters, shortcuts, new message */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <LifeBuoy aria-hidden className="size-5 text-green" />
        <span className="mr-1 font-display text-base font-semibold text-ink">Support</span>
        <Chip icon={<Inbox className="size-3.5" />} n={data.counts.needsReply} label="needs reply" />
        <Chip icon={<Flame className="size-3.5" />} n={data.counts.urgent} label="urgent" tone={data.counts.urgent ? "warn" : undefined} />
        <Chip icon={<AlertTriangle className="size-3.5" />} n={data.counts.overdue} label={`over ${data.sla} h`} tone={data.counts.overdue ? "danger" : undefined} />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setHelp((v) => !v)}>
            <Keyboard aria-hidden /> Shortcuts
          </Button>
          <NewMessage onStarted={(id) => router.push(href({ t: id, st: "all" }))} />
        </div>
      </div>
      {help ? (
        <div className="border-b border-line bg-canvas px-4 py-2.5 text-xs text-slate">
          <Kbd>j</Kbd> next · <Kbd>k</Kbd> previous · <Kbd>r</Kbd> reply · <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> send · <Kbd>?</Kbd> show or hide this
        </div>
      ) : null}

      <div className="grid min-h-[640px] lg:grid-cols-[340px_minmax(0,1fr)_300px]">
        {/* Queue */}
        <aside className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-line p-3">
            <nav aria-label="Queue" className="flex rounded-lg border border-line bg-canvas p-0.5 text-xs font-medium">
              {TABS.map(([id, label]) => (
                <Link key={id} href={href({ st: id, t: null })} aria-current={f.tab === id ? "page" : undefined} className={cn("flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-center text-[11.5px]", f.tab === id ? "bg-surface text-ink shadow-sm" : "text-slate hover:text-ink")}>
                  {label}
                </Link>
              ))}
            </nav>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(href({ q: String(new FormData(e.currentTarget).get("q") ?? ""), t: null }));
              }}
            >
              <div className="relative flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
                <Input name="q" defaultValue={f.search} placeholder="Search subject, email" className="h-9 pl-8 text-sm" aria-label="Search requests" />
              </div>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Refresh" onClick={() => router.refresh()}>
                <RefreshCw aria-hidden />
              </Button>
            </form>
            <div className="grid grid-cols-3 gap-2">
              <Select aria-label="Topic" value={f.topic ?? ""} onChange={(e) => router.push(href({ topic: e.target.value || null, t: null }))} className="h-9 text-xs">
                <option value="">All topics</option>
                {data.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Priority" value={f.priority ?? ""} onChange={(e) => router.push(href({ pri: e.target.value || null, t: null }))} className="h-9 text-xs">
                <option value="">Any priority</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </Select>
              <Select aria-label="Channel" value={f.channel ?? ""} onChange={(e) => router.push(href({ ch: e.target.value || null, t: null }))} className="h-9 text-xs">
                <option value="">Any channel</option>
                <option value="app">From the app</option>
                <option value="admin">Started by us</option>
              </Select>
            </div>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {data.list.length ? (
              data.list.map((t) => <QueueRow key={t.id} t={t} active={t.id === current} href={href({ t: t.id })} topic={topicLabel(t.topic)} />)
            ) : (
              <li className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-slate">
                <span className="flex size-12 items-center justify-center rounded-full border border-line bg-canvas">
                  <Inbox aria-hidden className="size-5" />
                </span>
                {f.tab === "needs_reply" && !f.search ? "Inbox zero: nothing is waiting on us." : "No requests here."}
              </li>
            )}
          </ul>
          <div className="border-t border-line px-4 py-2.5 text-xs text-slate">
            {data.list.length} request{data.list.length === 1 ? "" : "s"}
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col bg-canvas/40">
          {data.selected ? <Conversation key={data.selected.ticket.id} d={data.selected} topic={topicLabel(data.selected.ticket.topic)} me={data.me} replyRef={replyRef} /> : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center text-sm text-slate">
              <span className="flex size-12 items-center justify-center rounded-full border border-line bg-surface">
                <MessageSquare aria-hidden className="size-5" />
              </span>
              <p className="max-w-xs">
                Pick a request from the queue to read the conversation. <Kbd>j</Kbd> / <Kbd>k</Kbd> move, <Kbd>?</Kbd> lists every shortcut.
              </p>
            </div>
          )}
        </section>

        {/* Customer */}
        <aside className="border-t border-line lg:border-l lg:border-t-0">
          {data.customer ? <CustomerPanel c={data.customer} /> : (
            <p className="px-6 py-16 text-center text-sm text-slate">The person&apos;s plan, workspace, mailboxes, usage and recent activity appear here, from stored data only.</p>
          )}
        </aside>
      </div>
    </div>
    </TzContext.Provider>
  );
}

function Chip({ icon, n, label, tone }: { icon: React.ReactNode; n: number; label: string; tone?: "warn" | "danger" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", tone === "danger" ? "border-danger-fg/30 bg-danger-bg text-danger-fg" : tone === "warn" ? "border-warn-fg/30 bg-warn-bg text-warn-fg" : "border-line text-slate")}>
      {icon}
      <span className="font-semibold tabular-nums">{n}</span> {label}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">{children}</kbd>;
}

function QueueRow({ t, active, href, topic }: { t: Ticket; active: boolean; href: string; topic: string }) {
  const when = useWhen();
  return (
    <li>
      <Link href={href} aria-current={active ? "true" : undefined} className={cn("block px-4 py-3 transition-colors", active ? "bg-mint-soft/50" : "hover:bg-canvas")}>
        <span className="flex items-center gap-2">
          {t.status === "needs_reply" ? <span className="size-2 shrink-0 rounded-full bg-green" aria-label="Needs reply" /> : null}
          <span className={cn("min-w-0 flex-1 truncate text-sm text-ink", t.status === "needs_reply" && "font-semibold")}>{t.subject}</span>
          {t.priority === "urgent" ? <Flame aria-label="Urgent" className="size-3.5 shrink-0 text-warn-fg" /> : null}
          {t.overdue ? <AlertTriangle aria-label="Past the reply target" className="size-3.5 shrink-0 text-danger-fg" /> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate">{t.email}</span>
        <span className="mt-1 flex items-center gap-2 text-[11px] text-slate">
          <span className="rounded bg-canvas px-1.5 py-0.5">{topic}</span>
          <span>{when(t.updated_at)}</span>
          {t.assigned_to ? <span className="ml-auto truncate">→ {t.assigned_to.split("@")[0]}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function Conversation({ d, topic, me, replyRef }: { d: NonNullable<Data["selected"]>; topic: string; me: string; replyRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const router = useRouter();
  const when = useWhen();
  const t = d.ticket;
  const [pending, start] = React.useTransition();
  const [body, setBody] = React.useState("");
  const [note, setNote] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  // Show the newest message. (A block body: an effect must return nothing or a cleanup function.)
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [d.messages.length]);

  const update = (patch: Parameters<typeof adminUpdateSupportAction>[1]) =>
    start(async () => {
      await adminUpdateSupportAction(t.id, patch);
      router.refresh();
    });
  const send = () =>
    start(async () => {
      setError(null);
      const r = await adminReplySupportAction(t.id, body, note);
      if (r.ok) {
        setBody("");
        router.refresh();
      } else setError(r.error);
    });

  return (
    <>
      <header className="space-y-2 border-b border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="min-w-0 flex-1 font-display text-lg font-semibold text-ink">{t.subject}</h2>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin text-slate" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge tone={t.status === "needs_reply" ? "warn" : t.status === "resolved" ? "neutral" : "green"}>{STATUS_LABEL[t.status]}</Badge>
          {t.priority === "urgent" ? <Badge tone="danger">Urgent</Badge> : null}
          {t.overdue ? <Badge tone="danger">Past reply target</Badge> : null}
          <Badge tone="outline">{topic}</Badge>
          <Badge tone="outline">{t.channel === "app" ? "From the app" : "Started by us"}</Badge>
          <span className="text-slate">· {t.email} · opened {when(t.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {t.assigned_to === me ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => update({ unassign: true })}>
              <UserMinus aria-hidden /> Unassign
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => update({ assignToMe: true })}>
              <UserCheck aria-hidden /> {t.assigned_to ? "Take over" : "Assign to me"}
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => update({ priority: t.priority === "urgent" ? "normal" : "urgent" })}>
            <Flame aria-hidden /> {t.priority === "urgent" ? "Not urgent" : "Mark urgent"}
          </Button>
          {t.status === "resolved" ? (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => update({ status: "needs_reply" })}>
              <RotateCcw aria-hidden /> Reopen
            </Button>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => update({ status: "resolved" })}>
              <Check aria-hidden /> Resolve
            </Button>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" style={{ maxHeight: 460 }}>
        {d.messages.map((m) => (
          <div key={m.id} className={cn("max-w-[88%] rounded-2xl border px-4 py-3", m.internal ? "mx-auto border-warn-fg/30 bg-warn-bg" : m.author === "customer" ? "border-line bg-surface" : "ml-auto border-green/30 bg-mint-soft/50")}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate">
              {m.internal ? <Lock aria-hidden className="size-3" /> : null}
              {m.internal ? `Internal note · ${m.author_email ?? "admin"}` : m.author === "customer" ? t.email : `You (${m.author_email ?? "admin"})`} · {when(m.created_at)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{m.body}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="space-y-2 border-t border-line bg-surface p-4">
        <div className="flex rounded-lg border border-line bg-canvas p-0.5 text-xs font-medium" role="radiogroup" aria-label="Message type">
          {[
            [false, "Reply", "Emailed to them and shown in their app"],
            [true, "Internal note", "Only admins see it"],
          ].map(([v, label, hint]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={note === v} title={hint as string} onClick={() => setNote(v as boolean)} className={cn("flex-1 rounded-md px-2 py-1.5", note === v ? (v ? "bg-warn-bg text-warn-fg shadow-sm" : "bg-surface text-ink shadow-sm") : "text-slate hover:text-ink")}>
              {label as string}
            </button>
          ))}
        </div>
        <Textarea
          ref={replyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && body.trim().length >= 2) send();
          }}
          rows={4}
          placeholder={note ? "A note for admins only…" : `Reply to ${t.email}… (signed "Happy Sending, The Locenti Team")`}
          aria-label={note ? "Internal note" : "Reply"}
          className={note ? "border-warn-fg/40 bg-warn-bg/40" : undefined}
        />
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate">{note ? "Not sent to the customer." : "Sends an email from hello@locenti.com and notifies them in the app."}</span>
          <Button disabled={pending || body.trim().length < 2} onClick={send}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : note ? <Lock aria-hidden /> : <Send aria-hidden />} {note ? "Add note" : "Send reply"}
          </Button>
        </div>
      </div>
    </>
  );
}

function CustomerPanel({ c }: { c: NonNullable<Data["customer"]> }) {
  const when = useWhen();
  const trialLeft = c.workspace?.trialDaysLeft ?? null;
  return (
    <div className="space-y-5 p-5 text-sm">
      <div>
        <p className="font-semibold text-ink">{c.name ?? c.email.split("@")[0]}</p>
        <p className="truncate text-xs text-slate">{c.email}</p>
        <p className="mt-1 text-xs text-slate">
          Signed up {when(c.signedUpAt)} with {c.signUpMethod === "google" ? "Google" : "email"}
          {c.lastSignInAt ? ` · last sign-in ${when(c.lastSignInAt)}` : ""}
        </p>
      </div>
      <Section title="Workspace">
        {c.workspace ? (
          <>
            <p className="text-ink">{c.workspace.name}</p>
            <p className="text-xs text-slate">
              <span className="capitalize">{c.workspace.role}</span> · plan <span className="font-medium capitalize text-ink">{c.workspace.plan}</span>
              {trialLeft !== null ? (trialLeft > 0 ? ` · ${trialLeft} trial day${trialLeft === 1 ? "" : "s"} left` : " · trial ended") : ""}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate">No workspace yet.</p>
        )}
      </Section>
      <Section title="Usage">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {[
            ["Searches", c.counts.searches],
            ["Leads", c.counts.leads],
            ["Campaigns", c.counts.campaigns],
            ["Emails sent", c.counts.sent],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-line px-2.5 py-2">
              <dt className="text-slate">{k}</dt>
              <dd className="font-semibold tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Mailboxes">
        {c.mailboxes.length ? (
          <ul className="space-y-1 text-xs">
            {c.mailboxes.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink">{m.email}</span>
                <Badge tone={m.status === "connected" ? "green" : "warn"}>{m.status === "connected" ? "Connected" : "Needs reconnect"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate">None connected.</p>
        )}
      </Section>
      <Section title={`Recent activity · ${c.tickets} request${c.tickets === 1 ? "" : "s"} so far`}>
        {c.recent.length ? (
          <ul className="space-y-2 text-xs">
            {c.recent.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", r.outcome === "failed" ? "bg-danger-fg" : r.outcome === "success" ? "bg-green" : "bg-slate")} />
                <span>
                  <span className="text-ink">{r.summary}</span>
                  <span className="block text-slate">{when(r.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate">Nothing recorded yet.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate">{title}</p>
      {children}
    </div>
  );
}

/** "Message": start a conversation with any user. */
function NewMessage({ onStarted }: { onStarted: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [users, setUsers] = React.useState<{ id: string; email: string }[]>([]);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      adminFindUsersAction(search)
        .then((u) => setUsers(u))
        .catch(() => setUsers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus aria-hidden /> Message
      </Button>
      <DialogContent title="Message a user" description="Starts a conversation: they get it by email and in the app, and can reply." className="max-w-lg">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="msg-search">To</Label>
            <Input id="msg-search" value={search} onChange={(e) => (setSearch(e.target.value), setUserId(null))} placeholder="Search by email" autoComplete="off" />
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-line">
              {users.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => (setUserId(u.id), setSearch(u.email))} className={cn("block w-full px-3 py-2 text-left text-sm", userId === u.id ? "bg-mint-soft/60 text-ink" : "hover:bg-canvas")}>
                    {u.email}
                  </button>
                </li>
              ))}
              {!users.length ? <li className="px-3 py-2 text-sm text-slate">No matching accounts.</li> : null}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg-subject">Subject</Label>
            <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg-body">Message</Label>
            <Textarea id="msg-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={10000} />
          </div>
          {error ? <Callout tone="danger">{error}</Callout> : null}
          <Button
            className="w-full"
            disabled={pending || !userId || subject.trim().length < 3 || body.trim().length < 2}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await adminStartSupportAction({ userId: userId!, subject, body });
                if (r.ok) {
                  setOpen(false);
                  setSubject("");
                  setBody("");
                  onStarted(r.id);
                } else setError(r.error);
              })
            }
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send message
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
