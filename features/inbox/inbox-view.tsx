"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, FlaskConical, Inbox, ShieldBan, Sparkles, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Textarea, FieldHint } from "@/components/ui/field";
import { EmptyState, Callout } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { AiSuggestionBadge, EmailStatusBadge, FitBadge, SampleBadge } from "@/components/product/badges";
import { demo, useDemo } from "@/demo/store";
import { contactsOf, getBiz, suppressionMatch } from "@/demo/selectors";
import { setUi } from "@/demo/ui";
import type { Classification, Thread } from "@/demo/types";
import { cn, formatDateTime } from "@/lib/utils";

const FILTERS = [
  { id: "unanswered", label: "Unanswered" },
  { id: "interested", label: "Interested" },
  { id: "not_interested", label: "Not interested" },
  { id: "out_of_office", label: "Out of office" },
  { id: "all", label: "All replies" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const classMeta: Record<Classification, { label: string; tone: "green" | "neutral" | "warn" | "outline" }> = {
  interested: { label: "Interested", tone: "green" },
  not_interested: { label: "Not interested", tone: "neutral" },
  out_of_office: { label: "Out of office", tone: "warn" },
  unclassified: { label: "Unclassified", tone: "outline" },
};

const hasReply = (t: Thread) => t.messages.some((m) => m.direction === "inbound");
const unanswered = (t: Thread) => t.messages[t.messages.length - 1]?.direction === "inbound" && t.classification !== "out_of_office";

export function InboxView() {
  const s = useDemo();
  const [filter, setFilter] = React.useState<FilterId>("unanswered");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const replied = s.threads.filter(hasReply);
  const count = (f: FilterId) =>
    f === "all" ? replied.length : f === "unanswered" ? replied.filter(unanswered).length : replied.filter((t) => t.classification === f).length;
  const list = replied
    .filter((t) => (filter === "all" ? true : filter === "unanswered" ? unanswered(t) : t.classification === filter))
    .sort((a, b) => b.messages[b.messages.length - 1].at.localeCompare(a.messages[a.messages.length - 1].at));
  const open = s.threads.find((t) => t.id === openId) ?? null;

  const select = (id: string) => {
    setOpenId(id);
    demo.openThread(id);
  };

  return (
    <div>
      <PageHeader title="Inbox" description="Replies from every campaign. Labels are suggestions you can change. Suggested answers stay drafts until you send them." />

      <div className="mb-4 -mx-4 overflow-x-auto px-4 scrollbar-thin sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filter replies" className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              type="button"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors duration-200",
                filter === f.id ? "bg-ink text-white" : "text-slate hover:text-ink",
              )}
            >
              {f.label}
              <span className={cn("rounded px-1 text-[11px] tabular-nums", filter === f.id ? "bg-white/15" : "bg-ink/[0.06]")}>{count(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {!replied.length ? (
        <EmptyState icon={<Inbox />} title="No replies yet">
          Replies appear here after a campaign launches. In the demo, a simulated reply arrives a few seconds after a simulated launch.
        </EmptyState>
      ) : (
        <div className="card grid min-h-[560px] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_280px]">
          <ul className={cn("divide-y divide-line border-line lg:border-r", open && "hidden lg:block")} aria-label="Conversations">
            {list.length ? (
              list.map((t) => {
                const b = getBiz(s, t.leadId);
                const last = t.messages[t.messages.length - 1];
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => select(t.id)}
                      aria-current={openId === t.id}
                      className={cn("block w-full px-4 py-3 text-left transition-colors duration-200", openId === t.id ? "bg-mint-soft/50" : "hover:bg-canvas")}
                    >
                      <span className="flex items-center gap-2">
                        {t.unread ? <span className="size-2 shrink-0 rounded-full bg-green" aria-label="Unread" /> : null}
                        <span className={cn("min-w-0 flex-1 truncate text-sm text-ink", t.unread ? "font-semibold" : "font-medium")}>{b?.name}</span>
                        <span className="shrink-0 text-[11px] text-slate">{formatDateTime(last.at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate">{last.body.replace(/\s+/g, " ").slice(0, 90)}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <Badge tone={classMeta[t.classification].tone}>{classMeta[t.classification].label}</Badge>
                        {t.isSample ? <SampleBadge /> : <Badge tone="info">Simulated</Badge>}
                      </span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="p-6 text-center text-sm text-slate">Nothing in this view.</li>
            )}
          </ul>

          {open ? (
            <Conversation key={open.id} thread={open} onBack={() => setOpenId(null)} />
          ) : (
            <div className="hidden items-center justify-center p-8 lg:flex xl:col-span-2">
              <EmptyState icon={<Inbox />} title="Select a conversation" className="border-0 bg-transparent">
                Open a reply to read it, check its label and draft an answer.
              </EmptyState>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Conversation({ thread: t, onBack }: { thread: Thread; onBack: () => void }) {
  const s = useDemo();
  const router = useRouter();
  const { push } = useToast();
  const b = getBiz(s, t.leadId);
  const contact = b ? contactsOf(s, b)[0] : null;
  const campaign = s.campaigns.find((c) => c.id === t.campaignId);
  const brief = s.briefs[t.leadId];
  const inbound = [...t.messages].reverse().find((m) => m.direction === "inbound");
  const suppressed = inbound ? !!suppressionMatch(s, inbound.from) : false;
  const enrollment = s.enrollments.find((e) => e.campaignId === t.campaignId && e.leadId === t.leadId);

  return (
    <>
      <section className="flex min-w-0 flex-col" aria-label="Conversation">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <Button size="icon-sm" variant="ghost" className="lg:hidden" onClick={onBack} aria-label="Back to conversations">
            <ArrowLeft aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{t.subject}</p>
            <p className="text-xs text-slate">
              {b?.name} · {campaign?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`cls-${t.id}`} className="text-xs font-normal text-slate">
              Label
            </Label>
            <Select id={`cls-${t.id}`} value={t.classification} onChange={(e) => demo.setClassification(t.id, e.target.value as Classification)} className="h-8 w-40 text-[13px]">
              {Object.entries(classMeta).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="border-b border-line bg-canvas/50 px-5 py-1.5 text-[11px] text-slate">
          {t.classificationSource === "user" ? "Label set by you." : `Label suggested automatically (${t.suggestionConfidence} confidence). Change it if it's wrong.`}
        </p>

        <ol className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {t.messages.map((m) => (
            <li key={m.id} className={cn("max-w-[92%] rounded-[14px] border px-4 py-3", m.direction === "inbound" ? "border-line bg-surface" : "ml-auto border-green/20 bg-mint-soft/40")}>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate">
                <span className="font-medium text-ink">{m.direction === "inbound" ? b?.name : "You"}</span>
                <span className="font-mono">{m.direction === "inbound" ? m.from : `to ${m.to}`}</span>
                <span>{formatDateTime(m.at)} UTC</span>
                <span className="inline-flex items-center gap-1 rounded bg-demo-bg px-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-demo-fg">
                  <FlaskConical aria-hidden className="size-2.5" /> {m.direction === "inbound" ? "Simulated reply" : "Simulated · not delivered"}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-6 text-ink">{m.body}</p>
            </li>
          ))}
        </ol>

        <div className="border-t border-line p-4">
          {t.classification === "out_of_office" ? (
            <Callout tone="warn" className="mb-3">
              Auto-replies don&apos;t stop the sequence on their own. No reliable return date was found, so this lead is flagged for you to review rather than rescheduled.
            </Callout>
          ) : null}
          {t.classification === "not_interested" && inbound && !suppressed ? (
            <Callout tone="info" className="mb-3">
              <span className="flex flex-wrap items-center gap-2">
                This looks like an opt-out request.
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const r = demo.addSuppression(inbound.from, "Asked to be removed", "unsubscribe");
                    push(r.ok ? { tone: "success", title: "Added to suppression list", body: "This address won't be contacted again from this workspace." } : { tone: "error", title: "Couldn't add", body: r.reason });
                  }}
                >
                  <ShieldBan aria-hidden /> Add to suppression list
                </Button>
              </span>
            </Callout>
          ) : null}
          {t.replyDraft !== null ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`reply-${t.id}`}>Your reply</Label>
                <AiSuggestionBadge />
                <span className="text-xs text-slate">Draft. Edit freely. Nothing is sent automatically.</span>
              </div>
              <Textarea id={`reply-${t.id}`} value={t.replyDraft} onChange={(e) => demo.updateReplyDraft(t.id, e.target.value)} rows={5} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!t.replyDraft.trim()} onClick={() => demo.recordReply(t.id)}>
                  Send reply (simulated)
                </Button>
                <Button size="sm" variant="ghost" onClick={() => demo.updateReplyDraft(t.id, null)}>
                  Discard draft
                </Button>
              </div>
              <FieldHint>Replies are sent from your connected mailbox in the same thread.</FieldHint>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const r = demo.suggestReply(t.id);
                  if (!r.ok) push({ tone: "error", title: "Couldn't suggest a reply", body: r.reason });
                }}
              >
                <Sparkles aria-hidden /> Suggest a reply · 1 AI unit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => demo.updateReplyDraft(t.id, "")}>
                Write my own
              </Button>
            </div>
          )}
        </div>
      </section>

      <aside className="hidden border-l border-line bg-canvas/40 p-5 xl:block" aria-label="Lead context">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">Lead</p>
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-mint-soft text-green">
            <Building2 aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{b?.name}</p>
            <p className="text-xs text-slate">{b?.address}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-3 text-[13px]">
          <div>
            <dt className="text-xs text-slate">Contact</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 font-mono text-xs text-ink">
                <UserRound aria-hidden className="size-3" /> {contact?.email ?? "None"}
              </span>
              {contact ? <EmailStatusBadge status={contact.status} suppressed={contact.suppressed} /> : null}
            </dd>
          </div>
          {brief ? (
            <div>
              <dt className="text-xs text-slate">Fit for your offer</dt>
              <dd className="mt-1">
                <FitBadge level={brief.fit.level} />
              </dd>
              <dd className="mt-1.5 text-xs leading-5 text-slate">{brief.opportunities[0]?.text}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-slate">Sequence</dt>
            <dd className="mt-1 text-ink">{enrollment ? `${enrollment.state}${enrollment.reason ? `: ${enrollment.reason}` : ""}` : "Not enrolled"}</dd>
          </div>
        </dl>
        <Button
          size="sm"
          variant="secondary"
          className="mt-5 w-full"
          onClick={() => {
            setUi({ leadId: t.leadId });
            router.push("/demo/leads");
          }}
        >
          Open lead
        </Button>
      </aside>
    </>
  );
}
