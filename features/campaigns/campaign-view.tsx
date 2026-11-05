"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Pause, Play, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { describeSchedule, TIMEZONES } from "@/lib/campaigns/schedule";
import { writeCampaignDraftsAction, writeDraftAction } from "@/server/actions/ai";
import { approveAction, campaignStatusAction, dropRecipientAction, editDraftAction, saveCampaignSettingsAction, sendDueNowAction } from "@/server/actions/campaigns";
import type { CampaignRow, RecipientRow } from "@/server/campaign-store";
import type { MailboxRow } from "@/server/mailbox-store";
import { cn, formatDateTime } from "@/lib/utils";

type Recipient = RecipientRow & { decision: { send: true } | { send: false; reason: string } };
type Msg = { tone: "green" | "danger" | "info"; text: string } | null;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CampaignView({ campaign, recipients, mailboxes, canManage, aiConfigured }: { campaign: CampaignRow; recipients: Recipient[]; mailboxes: MailboxRow[]; canManage: boolean; aiConfigured: boolean }) {
  return campaign.status === "draft" ? (
    <DraftCampaign campaign={campaign} recipients={recipients} mailboxes={mailboxes} canManage={canManage} aiConfigured={aiConfigured} />
  ) : (
    <LiveCampaign campaign={campaign} recipients={recipients} mailboxes={mailboxes} canManage={canManage} />
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<Msg>(null);
  const run = <T extends { ok: true } | { ok: false; error: string }>(fn: () => Promise<T>, okText: string | ((r: Extract<T, { ok: true }>) => string)) =>
    start(async () => {
      const r = await fn();
      if (r.ok) setMsg({ tone: "green", text: typeof okText === "function" ? okText(r as Extract<T, { ok: true }>) : okText });
      else setMsg({ tone: "danger", text: (r as { error: string }).error });
      router.refresh();
    });
  return { pending, msg, setMsg, run };
}

/* ------------------------------------------------------------------ draft */

function DraftCampaign({ campaign, recipients, mailboxes, canManage, aiConfigured }: { campaign: CampaignRow; recipients: Recipient[]; mailboxes: MailboxRow[]; canManage: boolean; aiConfigured: boolean }) {
  const willSend = recipients.filter((r) => r.decision.send);
  const ai = useAction();
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-ink">Recipients and messages</h2>
            <p className="mt-0.5 text-[13px] text-slate">Open each one to read and edit the exact email. {willSend.length} of {recipients.length} will be sent.</p>
          </div>
          {canManage && aiConfigured ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={ai.pending}
              onClick={() =>
                ai.run(
                  () => writeCampaignDraftsAction(campaign.id),
                  (r) => `AI wrote ${r.written} email${r.written === 1 ? "" : "s"}${r.failed ? `; ${r.failed} failed (${r.firstError})` : ""}. Read them before approving.`,
                )
              }
            >
              {ai.pending ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} {ai.pending ? "Writing…" : "Write all with AI"}
            </Button>
          ) : null}
        </div>
        {ai.msg ? (
          <div className="border-b border-line px-5 py-2.5">
            <Callout tone={ai.msg.tone === "info" ? "info" : ai.msg.tone} className="py-1.5">
              <span role="status">{ai.msg.text}</span>
            </Callout>
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {recipients.map((r) => (
            <RecipientItem key={`${r.lead_id}-${r.draft_version ?? 0}`} r={r} campaignId={campaign.id} editable={canManage} aiConfigured={aiConfigured} />
          ))}
        </ul>
      </section>
      <div className="space-y-5">
        <ApprovePanel campaign={campaign} willSend={willSend.length} total={recipients.length} canManage={canManage} mailboxes={mailboxes} />
        <SettingsForm campaign={campaign} mailboxes={mailboxes} canManage={canManage} />
      </div>
    </div>
  );
}

function RecipientItem({ r, campaignId, editable, aiConfigured }: { r: Recipient; campaignId: string; editable: boolean; aiConfigured: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState(r.subject ?? "");
  const [body, setBody] = React.useState(r.body ?? "");
  const { pending, msg, run } = useAction();
  const dirty = subject !== (r.subject ?? "") || body !== (r.body ?? "");
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-canvas">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
          <span className="block truncate text-xs text-slate">
            <span className="font-mono">{r.email ?? "No email"}</span>
            {r.subject ? ` · ${r.subject}` : ""}
          </span>
        </span>
        {r.decision.send ? <Badge tone="green">Will send</Badge> : <Badge tone="neutral">{r.decision.reason}</Badge>}
        {r.draft_origin === "edited" ? <Badge tone="outline">Edited</Badge> : r.draft_origin === "ai" ? <Badge tone="info">AI</Badge> : r.draft_origin === "agent" ? <Badge tone="info">Agent</Badge> : null}
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-slate transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 bg-canvas/50 px-5 pb-5 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor={`s-${r.lead_id}`}>Subject</Label>
            <Input id={`s-${r.lead_id}`} value={subject} maxLength={140} disabled={!editable} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`b-${r.lead_id}`}>Message</Label>
            <Textarea id={`b-${r.lead_id}`} value={body} rows={12} disabled={!editable} onChange={(e) => setBody(e.target.value)} className="font-[inherit] text-sm leading-6" />
            <FieldHint>Locentio adds your business address and an unsubscribe link below the message when it sends.</FieldHint>
          </div>
          {msg ? (
            <Callout tone={msg.tone === "info" ? "info" : msg.tone} className="py-1.5">
              <span role="status">{msg.text}</span>
            </Callout>
          ) : null}
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!dirty || pending} onClick={() => run(() => editDraftAction(campaignId, r.lead_id, { subject, body }), "Saved. Approve the campaign again to include this change.")}>
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : null} Save message
              </Button>
              {aiConfigured && r.has_brief ? (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => writeDraftAction(r.lead_id), "Rewritten by AI. Read it before approving.")}>
                  <Sparkles aria-hidden /> Rewrite with AI
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => dropRecipientAction(campaignId, r.lead_id), "Removed.")}>
                <X aria-hidden /> Remove from campaign
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ApprovePanel({ campaign, willSend, total, canManage, mailboxes }: { campaign: CampaignRow; willSend: number; total: number; canManage: boolean; mailboxes: MailboxRow[] }) {
  const [confirmed, setConfirmed] = React.useState(false);
  const { pending, msg, run } = useAction();
  const box = mailboxes.find((m) => m.id === campaign.sending_account_id);
  const days = box ? Math.ceil(willSend / Math.max(1, box.daily_cap)) : null;
  return (
    <section className="card p-5">
      <h2 className="font-display text-base font-semibold text-ink">Approve and launch</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate">Will be sent</dt>
          <dd className="font-medium text-ink">
            {willSend} of {total}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate">From</dt>
          <dd className="truncate font-mono text-xs text-ink">{box ? box.email : "No mailbox chosen"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate">When</dt>
          <dd className="text-right text-xs text-ink">{describeSchedule(campaign.schedule)}</dd>
        </div>
        {box ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate">Pace</dt>
            <dd className="text-right text-xs text-ink">
              Up to {box.daily_cap} a day, a few minutes apart{days && days > 1 ? ` (about ${days} sending days)` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
      {box && box.status !== "connected" ? (
        <Callout tone="warn" className="mt-3">
          This mailbox needs reconnecting on the Mailboxes page.
        </Callout>
      ) : null}
      {canManage ? (
        <>
          <label className="mt-4 flex items-start gap-2.5 text-sm text-ink">
            <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            <span>I&apos;ve reviewed every recipient and message, and I have a legitimate reason to contact these businesses.</span>
          </label>
          {msg ? (
            <Callout tone={msg.tone === "info" ? "info" : msg.tone} className="mt-3 py-1.5">
              <span role="status">{msg.text}</span>
            </Callout>
          ) : null}
          <Button
            className="mt-4 w-full"
            disabled={!confirmed || pending || !willSend}
            onClick={() =>
              run(
                () => approveAction(campaign.id, campaign.revision, confirmed),
                (r) => `Approved ${r.enrolled}. ${r.sentNow ? "The first email was sent." : "Sending starts within the sending hours."}`,
              )
            }
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Approve and launch
          </Button>
          <p className="mt-2 text-xs text-slate">Approval covers this exact version (revision {campaign.revision}). Any edit afterwards needs a new approval.</p>
        </>
      ) : (
        <p className="mt-4 text-xs text-slate">Only workspace owners and admins can approve.</p>
      )}
    </section>
  );
}

function SettingsForm({ campaign, mailboxes, canManage }: { campaign: CampaignRow; mailboxes: MailboxRow[]; canManage: boolean }) {
  const s = campaign.schedule;
  const [days, setDays] = React.useState<number[]>(s.days);
  const { pending, msg, run } = useAction();
  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () =>
            saveCampaignSettingsAction(campaign.id, {
              name: String(fd.get("name")),
              mailboxId: String(fd.get("mailboxId")) || null,
              timezone: String(fd.get("timezone")),
              days,
              startHour: Number(fd.get("startHour")),
              endHour: Number(fd.get("endHour")),
              includeUnknown: fd.get("includeUnknown") === "on",
              includeCatchAll: fd.get("includeCatchAll") === "on",
            }),
          "Settings saved.",
        );
      }}
    >
      <h2 className="font-display text-base font-semibold text-ink">Settings</h2>
      <fieldset disabled={!canManage} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cs-name">Name</Label>
          <Input id="cs-name" name="name" defaultValue={campaign.name} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-box">Send from</Label>
          <Select id="cs-box" name="mailboxId" defaultValue={campaign.sending_account_id ?? ""}>
            <option value="">Choose a mailbox</option>
            {mailboxes
              .filter((m) => m.status !== "disconnected")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email} · {m.daily_cap}/day{m.status !== "connected" ? " (needs reconnecting)" : ""}
                </option>
              ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-tz">Time zone</Label>
          <Select id="cs-tz" name="timezone" defaultValue={s.timezone}>
            {[...new Set([s.timezone, ...TIMEZONES])].map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <FieldHint>Use your recipients&apos; time zone.</FieldHint>
        </div>
        <div>
          <Label>Sending days</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(i)}
                onClick={() => setDays((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]))}
                className={cn("rounded-md border px-2 py-1 text-xs font-medium", days.includes(i) ? "border-green bg-mint-soft text-green" : "border-line text-slate")}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cs-start">From</Label>
            <Select id="cs-start" name="startHour" defaultValue={String(s.startHour)}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-end">Until</Label>
            <Select id="cs-end" name="endHour" defaultValue={String(s.endHour)}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                <option key={h} value={h}>
                  {String(h % 24).padStart(2, "0")}:00
                </option>
              ))}
            </Select>
          </div>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <Checkbox name="includeUnknown" defaultChecked={campaign.policy.includeUnknown} className="mt-0.5" />
          <span>
            Include addresses that aren&apos;t verified
            <span className="block text-xs text-slate">No paid verifier is connected, so most addresses are unverified. They were published by the business, but may bounce.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <Checkbox name="includeCatchAll" defaultChecked={campaign.policy.includeCatchAll} className="mt-0.5" />
          <span>Include catch-all domains</span>
        </label>
      </fieldset>
      {msg ? (
        <Callout tone={msg.tone === "info" ? "info" : msg.tone} className="py-1.5">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}
      {canManage ? (
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null} Save settings
        </Button>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------- running and after */

const stateBadge = (r: Recipient) => {
  if (r.dispatch_status === "accepted") return <Badge tone="green">Sent{r.accepted_at ? ` ${formatDateTime(r.accepted_at)}` : ""}</Badge>;
  if (r.enrollment_state === "queued") return <Badge tone="info">Queued</Badge>;
  if (r.enrollment_state === "stopped") return <Badge tone={r.dispatch_status === "ambiguous" ? "warn" : "neutral"}>{r.enrollment_reason ?? "Stopped"}</Badge>;
  if (r.enrollment_state === "replied") return <Badge tone="green">Replied</Badge>;
  return <Badge tone="outline">Not included</Badge>;
};

function LiveCampaign({ campaign, recipients, mailboxes, canManage }: { campaign: CampaignRow; recipients: Recipient[]; mailboxes: MailboxRow[]; canManage: boolean }) {
  const { pending, msg, setMsg, run } = useAction();
  const router = useRouter();
  const [sending, startSend] = React.useTransition();
  const box = mailboxes.find((m) => m.id === campaign.sending_account_id);
  const sent = recipients.filter((r) => r.dispatch_status === "accepted").length;
  const queued = recipients.filter((r) => r.enrollment_state === "queued").length;
  const stopped = recipients.filter((r) => r.enrollment_state === "stopped").length;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <section className="card">
        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          {[
            ["Sent", sent],
            ["Queued", queued],
            ["Stopped", stopped],
          ].map(([label, n]) => (
            <div key={label} className="px-5 py-4">
              <p className="text-xs text-slate">{label}</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-ink">{n}</p>
            </div>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {recipients.map((r) => (
            <li key={r.lead_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="block truncate text-xs text-slate">
                  <span className="font-mono">{r.email ?? "No email"}</span>
                  {r.subject ? ` · ${r.subject}` : ""}
                </span>
                {r.dispatch_error && r.dispatch_status !== "accepted" ? <span className="block text-xs text-danger-fg">{r.dispatch_error}</span> : null}
              </span>
              {stateBadge(r)}
            </li>
          ))}
        </ul>
      </section>
      <div className="space-y-5">
        <section className="card space-y-3 p-5">
          <h2 className="font-display text-base font-semibold text-ink">Sending</h2>
          <p className="text-sm text-slate">
            From <span className="font-mono text-xs text-ink">{box?.email ?? "no mailbox"}</span>, {describeSchedule(campaign.schedule)}, up to {box?.daily_cap ?? 0} a day, a few minutes apart.
          </p>
          {campaign.status === "paused" ? (
            <Callout tone="warn">Paused. Nothing is sent until you resume.{box && box.status !== "connected" ? " The mailbox needs reconnecting first." : ""}</Callout>
          ) : null}
          {msg ? (
            <Callout tone={msg.tone === "info" ? "info" : msg.tone} className="py-1.5">
              <span role="status">{msg.text}</span>
            </Callout>
          ) : null}
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {campaign.status === "running" ? (
                <>
                  <Button
                    size="sm"
                    disabled={sending}
                    onClick={() =>
                      startSend(async () => {
                        const r = await sendDueNowAction();
                        setMsg(r.ok ? { tone: r.sent ? "green" : "info", text: r.sent ? `Sent ${r.sent} email${r.sent === 1 ? "" : "s"}.` : (r.note ?? "Nothing is due right now.") } : { tone: "danger", text: r.error });
                        router.refresh();
                      })
                    }
                  >
                    {sending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send next due email
                  </Button>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => campaignStatusAction(campaign.id, "pause"), "Paused.")}>
                    <Pause aria-hidden /> Pause
                  </Button>
                </>
              ) : null}
              {campaign.status === "paused" ? (
                <Button size="sm" disabled={pending} onClick={() => run(() => campaignStatusAction(campaign.id, "resume"), "Resumed.")}>
                  <Play aria-hidden /> Resume
                </Button>
              ) : null}
              {campaign.status === "running" || campaign.status === "paused" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Cancel this campaign? Queued emails won't be sent. Emails already sent stay sent.")) run(() => campaignStatusAction(campaign.id, "cancel"), "Cancelled.");
                  }}
                >
                  <Trash2 aria-hidden /> Cancel
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs leading-5 text-slate">
            Emails go out automatically during sending hours while Locentio is open in any tab (or around the clock with the optional scheduler). &quot;Send next due email&quot; sends one now, using the same limits.
          </p>
        </section>
      </div>
    </div>
  );
}
