"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Mail,
  Megaphone,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Callout, EmptyState } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { EmailStatusBadge, NoEmailBadge, SampleBadge } from "@/components/product/badges";
import { demo, useDemo } from "@/demo/store";
import { approvalValid, campaignMetrics, contactsOf, evaluateRecipients, getBiz } from "@/demo/selectors";
import { setUi, useUi } from "@/demo/ui";
import { offerTypeLabels } from "@/demo/research";
import type { Campaign, CampaignStep } from "@/demo/types";
import { cn, formatDateTime, formatRate } from "@/lib/utils";
import { CampaignStatusBadge } from "./status";

export function CampaignsView() {
  const s = useDemo();
  const ui = useUi();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [name, setName] = React.useState("");

  if (ui.campaignId && ui.campaignId !== selectedId) {
    setSelectedId(ui.campaignId);
    setUi({ campaignId: null });
  }

  const selected = s.campaigns.find((c) => c.id === selectedId);
  if (selected) return <CampaignDetail key={selected.id} campaign={selected} onBack={() => setSelectedId(null)} />;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Short sequences you approve version by version. In this demo, launching is simulated and no email is sent."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus aria-hidden /> New campaign
          </Button>
        }
      />
      {s.campaigns.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Campaigns</caption>
              <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Campaign</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">Recipients</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">Sent</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">Reply rate</th>
                  <th scope="col" className="py-2.5 pr-5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {s.campaigns.map((c) => {
                  const m = campaignMetrics(s, c);
                  return (
                    <tr key={c.id} className="border-b border-line transition-colors duration-200 last:border-b-0 hover:bg-canvas/60">
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => setSelectedId(c.id)} className="inline-flex items-center gap-2 text-left font-medium text-ink hover:text-green hover:underline">
                          {c.name}
                        </button>
                        {c.isSample ? <SampleBadge /> : null}
                        <span className="block text-xs text-slate">{c.offerSnapshot || "No offer"}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <CampaignStatusBadge status={c.status} />
                        {c.status === "draft" && approvalValid(c) ? <Badge tone="green" className="ml-1">Approved</Badge> : null}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{c.leadIds.length}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{m.sent}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{formatRate(m.replyRate)}</td>
                      <td className="whitespace-nowrap py-3 pr-5 text-xs text-slate">{formatDateTime(c.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-slate">
            Reply rate = unique recipients who replied (excluding auto-replies) ÷ unique recipients sent to. “Sent” means accepted by the simulated mailbox, not confirmed delivery.
          </p>
        </div>
      ) : (
        <EmptyState
          icon={<Megaphone />}
          title="No campaigns yet"
          action={
            <>
              <Button onClick={() => setNewOpen(true)}>New campaign</Button>
              <Button asChild variant="secondary">
                <Link href="/demo/leads">Go to Leads</Link>
              </Button>
            </>
          }
        >
          Create a draft, then add researched leads with approved drafts. Nothing is enrolled automatically.
        </EmptyState>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="New campaign" description="You'll add recipients and review every step before anything can launch.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2) return;
              const id = demo.createCampaign(name, []);
              setName("");
              setNewOpen(false);
              setSelectedId(id);
            }}
            className="space-y-3"
          >
            <Label htmlFor="camp-name">Name</Label>
            <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Denver HVAC · review replies" autoFocus />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={name.trim().length < 2}>
                Create draft
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STEPS = [
  { id: "audience", label: "Audience", icon: Users },
  { id: "offer", label: "Offer", icon: ShieldCheck },
  { id: "sequence", label: "Sequence", icon: Mail },
  { id: "mailbox", label: "Mailbox", icon: Mail },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "review", label: "Review & launch", icon: CheckCircle2 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function CampaignDetail({ campaign: c, onBack }: { campaign: Campaign; onBack: () => void }) {
  const s = useDemo();
  const { push } = useToast();
  const [step, setStep] = React.useState<StepId>(c.status === "draft" ? "audience" : "review");
  const elig = evaluateRecipients(s, c);
  const eligible = elig.filter((e) => e.eligible);
  const editable = c.status === "draft" || c.status === "paused";
  const approved = approvalValid(c);
  const m = campaignMetrics(s, c);

  const checks: Record<StepId, boolean> = {
    audience: eligible.length > 0,
    offer: !!s.offer,
    sequence: c.steps.every((st) => st.kind === "initial" || (st.subject.trim() && st.body.trim())),
    mailbox: !!c.mailboxId,
    schedule: c.schedule.days.length > 0 && c.schedule.endHour > c.schedule.startHour,
    review: approved,
  };

  const res = (r: { ok: boolean; reason?: string }, ok: string) =>
    push(r.ok ? { tone: "success", title: ok } : { tone: "error", title: "Not yet", body: r.reason });

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-slate hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All campaigns
      </button>
      <PageHeader
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={c.status} />
            {c.isSample ? <SampleBadge /> : null}
            {approved ? <Badge tone="green">Approved revision {c.approval!.revision}</Badge> : c.approval ? <Badge tone="warn">Approval out of date</Badge> : <Badge tone="outline">Not approved</Badge>}
            <span className="text-[13px]">Revision {c.revision}</span>
          </span>
        }
        actions={
          <>
            {c.status === "running" ? (
              <Button variant="secondary" onClick={() => demo.pauseCampaign(c.id)}>
                <Pause aria-hidden /> Pause
              </Button>
            ) : null}
            {c.status === "paused" ? (
              <Button onClick={() => res(demo.resumeCampaign(c.id), "Resumed (simulated)")}>
                <Play aria-hidden /> Resume
              </Button>
            ) : null}
            {c.status === "running" || c.status === "paused" ? (
              <Button variant="ghost" onClick={() => demo.cancelCampaign(c.id)}>
                <XCircle aria-hidden /> Cancel campaign
              </Button>
            ) : null}
            {c.status === "draft" ? (
              <Button
                variant="ghost"
                className="text-danger-fg"
                onClick={() => {
                  demo.deleteCampaign(c.id);
                  onBack();
                }}
              >
                <Trash2 aria-hidden /> Delete draft
              </Button>
            ) : null}
          </>
        }
      />

      {c.status !== "draft" ? (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Queued", m.queued],
            ["Sent (simulated)", m.sent],
            ["Replied", m.replied],
            ["Interested", m.interested],
            ["Reply rate", formatRate(m.replyRate)],
          ].map(([k, v]) => (
            <div key={k} className="card px-4 py-3">
              <p className="text-xs text-slate">{k}</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink">{v}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Campaign setup steps">
          <ol className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin lg:flex-col lg:overflow-visible">
            {STEPS.map((st, i) => (
              <li key={st.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(st.id)}
                  aria-current={step === st.id ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm transition-colors duration-200",
                    step === st.id ? "bg-surface font-medium text-ink shadow-card" : "text-slate hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      checks[st.id] ? "bg-green text-white" : "bg-ink/[0.07] text-slate",
                    )}
                  >
                    {checks[st.id] ? <CheckCircle2 aria-hidden className="size-3.5" /> : i + 1}
                  </span>
                  {st.label}
                  <span className="sr-only">{checks[st.id] ? " (complete)" : " (incomplete)"}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          {!editable && step !== "review" ? (
            <Callout tone="info" className="mb-4" icon={<CircleAlert />}>
              {c.status === "running" ? "Pause the campaign to change recipients, content or schedule. Any change removes approval." : "This campaign can no longer be edited."}
            </Callout>
          ) : null}

          {step === "audience" ? <AudienceStep c={c} editable={editable} /> : null}
          {step === "offer" ? <OfferStep /> : null}
          {step === "sequence" ? <SequenceStep c={c} editable={editable} /> : null}
          {step === "mailbox" ? <MailboxStep c={c} editable={editable} /> : null}
          {step === "schedule" ? <ScheduleStep c={c} editable={editable} /> : null}
          {step === "review" ? <ReviewStep c={c} checks={checks} onGo={setStep} /> : null}

          {step !== "review" ? (
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setStep(STEPS[STEPS.findIndex((x) => x.id === step) + 1].id)}>
                Next <ChevronRight aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AudienceStep({ c, editable }: { c: Campaign; editable: boolean }) {
  const s = useDemo();
  const router = useRouter();
  const { push } = useToast();
  const [addOpen, setAddOpen] = React.useState(false);
  const [pick, setPick] = React.useState<string[]>([]);
  const elig = evaluateRecipients(s, c);
  const available = Object.keys(s.leads).filter((id) => !c.leadIds.includes(id));
  const unverified = elig
    .filter((e) => e.reason === "Not verified yet" && e.contactId)
    .map((e) => e.contactId!) as string[];

  return (
    <SectionCard
      title="Audience"
      description={`${elig.filter((e) => e.eligible).length} eligible of ${elig.length}. Eligibility is checked again immediately before each send.`}
      actions={
        editable ? (
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)} disabled={!available.length}>
            <Plus aria-hidden /> Add leads
          </Button>
        ) : null
      }
      bodyClassName="p-0"
    >
      <div className="space-y-3 border-b border-line px-5 py-4">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <Switch
              checked={c.policy.includeCatchAll}
              disabled={!editable}
              onCheckedChange={(v) => demo.updateCampaign(c.id, { policy: { ...c.policy, includeCatchAll: v } })}
              aria-label="Include catch-all addresses"
            />
            Include catch-all addresses
          </label>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <Switch
              checked={c.policy.includeUnknown}
              disabled={!editable}
              onCheckedChange={(v) => demo.updateCampaign(c.id, { policy: { ...c.policy, includeUnknown: v } })}
              aria-label="Include unknown results"
            />
            Include unknown results
          </label>
        </div>
        {c.policy.includeCatchAll || c.policy.includeUnknown ? (
          <Callout tone="warn">These addresses could not be confirmed. Including them raises the chance of bounces, which can hurt your mailbox&apos;s reputation.</Callout>
        ) : (
          <FieldHint>Off by default: only addresses verified as valid are contacted. Invalid and suppressed addresses are never contacted.</FieldHint>
        )}
        {unverified.length && editable ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const r = demo.verify(unverified);
              push(r.ok ? { tone: "info", title: `Verifying ${unverified.length}` } : { tone: "error", title: "Couldn't verify", body: r.reason });
            }}
          >
            Verify {unverified.length} unverified · {unverified.length} unit{unverified.length === 1 ? "" : "s"}
          </Button>
        ) : null}
      </div>
      {elig.length ? (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Recipients and eligibility</caption>
            <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Business</th>
                <th scope="col" className="py-2.5 pr-3 font-medium">Email</th>
                <th scope="col" className="py-2.5 pr-3 font-medium">Eligibility</th>
                <th scope="col" className="py-2.5 pr-5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {elig.map((e) => {
                const b = getBiz(s, e.leadId);
                const contact = b ? contactsOf(s, b)[0] : null;
                return (
                  <tr key={e.leadId} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        className="text-left font-medium text-ink hover:text-green hover:underline"
                        onClick={() => {
                          setUi({ leadId: e.leadId });
                          router.push("/demo/leads");
                        }}
                      >
                        {e.name}
                      </button>
                    </td>
                    <td className="py-3 pr-3">
                      {contact ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs text-slate">{contact.email}</span>
                          <EmailStatusBadge status={contact.status} verifying={contact.verifying} suppressed={contact.suppressed} />
                        </span>
                      ) : (
                        <NoEmailBadge />
                      )}
                    </td>
                    <td className="py-3 pr-3">{e.eligible ? <Badge tone="green">Eligible</Badge> : <span className="text-[13px] text-danger-fg">{e.reason}</span>}</td>
                    <td className="py-3 pr-5 text-right">
                      {editable ? (
                        <Button size="sm" variant="ghost" onClick={() => demo.removeFromCampaign(c.id, e.leadId)} aria-label={`Remove ${e.name}`}>
                          Remove
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState icon={<Users />} title="No recipients yet" action={editable && available.length ? <Button size="sm" onClick={() => setAddOpen(true)}>Add leads</Button> : <Button asChild size="sm" variant="secondary"><Link href="/demo/discover">Find leads</Link></Button>}>
            Add saved leads. Each one needs a verified address and its own draft.
          </EmptyState>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title="Add saved leads" description="Only leads you choose are added." className="max-w-xl">
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {available.map((id) => {
              const b = getBiz(s, id)!;
              const on = pick.includes(id);
              return (
                <li key={id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
                    <Checkbox checked={on} onChange={() => setPick((xs) => (on ? xs.filter((x) => x !== id) : [...xs, id]))} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{b.name}</span>
                      <span className="text-xs text-slate">
                        {b.city} · {s.drafts[id] ? "Draft ready" : s.briefs[id] ? "Researched, no draft" : "Not researched"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pick.length}
              onClick={() => {
                const r = demo.addToCampaign(c.id, pick);
                if (!r.ok) push({ tone: "error", title: "Couldn't add", body: r.reason });
                setPick([]);
                setAddOpen(false);
              }}
            >
              Add {pick.length || ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function OfferStep() {
  const s = useDemo();
  const o = s.offer;
  return (
    <SectionCard title="Offer" description="Drafts and briefs use your workspace offer profile." actions={<Button asChild size="sm" variant="secondary"><Link href="/demo/settings#offer">Edit offer</Link></Button>}>
      {o ? (
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ["Offer type", offerTypeLabels[o.serviceType]],
            ["Service", o.service],
            ["Target customer", o.targetCustomer],
            ["Tone", o.tone],
            ["Sender", `${o.senderName}${o.senderTitle ? `, ${o.senderTitle}` : ""} · ${o.companyName}`],
            ["Business address", o.businessAddress],
            ["Value proposition", o.valueProp],
            ["Booking link", o.bookingLink || "None"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate">{k}</dt>
              <dd className="mt-0.5 text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <EmptyState title="No offer profile" action={<Button asChild size="sm"><Link href="/demo/onboarding">Set up offer</Link></Button>}>
          Set up what you sell before approving a campaign.
        </EmptyState>
      )}
    </SectionCard>
  );
}

function SequenceStep({ c, editable }: { c: Campaign; editable: boolean }) {
  const s = useDemo();
  const [steps, setSteps] = React.useState<CampaignStep[]>(c.steps);
  const [rev, setRev] = React.useState(c.revision);
  if (rev !== c.revision) {
    setRev(c.revision);
    setSteps(c.steps);
  }
  const dirty = JSON.stringify(steps) !== JSON.stringify(c.steps);
  const update = (id: string, patch: Partial<CampaignStep>) => setSteps((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <SectionCard
      title="Sequence"
      description="One personal first email per lead, then short follow-ups. Follow-ups stop on any reply, unsubscribe or bounce."
      actions={
        editable ? (
          <Button size="sm" disabled={!dirty} onClick={() => demo.updateCampaign(c.id, { steps })}>
            Save sequence
          </Button>
        ) : null
      }
    >
      <ol className="space-y-4">
        {steps.map((st, i) => (
          <li key={st.id} className="rounded-[12px] border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
              <span className="text-sm font-semibold text-ink">{st.kind === "initial" ? "First email" : `Follow-up ${i}`}</span>
              {st.kind === "follow_up" ? (
                <span className="flex items-center gap-1.5 text-[13px] text-slate">
                  <Label htmlFor={`delay-${st.id}`} className="font-normal text-slate">
                    after
                  </Label>
                  <Input
                    id={`delay-${st.id}`}
                    type="number"
                    min={1}
                    max={30}
                    value={st.delayDays}
                    disabled={!editable}
                    onChange={(e) => update(st.id, { delayDays: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
                    className="h-8 w-16"
                  />
                  business days
                </span>
              ) : (
                <span className="text-[13px] text-slate">Day 0</span>
              )}
            </div>
            {st.kind === "initial" ? (
              <div className="mt-3 space-y-1.5 text-[13px]">
                <p className="text-slate">Each lead receives its own approved draft:</p>
                <ul className="space-y-1">
                  {c.leadIds.map((id) => (
                    <li key={id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{getBiz(s, id)?.name}</span>
                      {s.drafts[id] ? (
                        <span className="text-slate">
                          v{s.drafts[id].version} · “{s.drafts[id].subject}”
                        </span>
                      ) : (
                        <Badge tone="warn">No draft yet</Badge>
                      )}
                    </li>
                  ))}
                  {!c.leadIds.length ? <li className="text-slate">Add recipients first.</li> : null}
                </ul>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`subj-${st.id}`}>Subject</Label>
                  <Input id={`subj-${st.id}`} value={st.subject} disabled={!editable} onChange={(e) => update(st.id, { subject: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`body-${st.id}`}>Body</Label>
                  <Textarea id={`body-${st.id}`} value={st.body} disabled={!editable} rows={5} onChange={(e) => update(st.id, { body: e.target.value })} />
                  <FieldHint>Merge fields: {"{{business_name}}"}, {"{{sender_name}}"}, {"{{previous_subject}}"}.</FieldHint>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {dirty ? <p className="mt-3 text-xs text-warn-fg">Unsaved changes. Saving removes any existing approval.</p> : null}
    </SectionCard>
  );
}

function MailboxStep({ c, editable }: { c: Campaign; editable: boolean }) {
  return (
    <SectionCard title="Sending mailbox" description="Messages are sent from a mailbox you connect. Your Locentra sign-in and mailbox access are separate.">
      <fieldset className="space-y-2">
        <legend className="sr-only">Mailbox</legend>
        <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", c.mailboxId === "demo-mailbox" ? "border-green bg-mint-soft/40" : "border-line", !editable && "cursor-not-allowed opacity-70")}>
          <input type="radio" name="mailbox" className="mt-1 accent-green" checked={c.mailboxId === "demo-mailbox"} disabled={!editable} onChange={() => demo.updateCampaign(c.id, { mailboxId: "demo-mailbox" })} />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FlaskConical aria-hidden className="size-4 text-demo-fg" /> Demo mailbox
            </span>
            <span className="mt-0.5 block text-[13px] leading-5 text-slate">Simulated. Accepts messages and delivers nothing. Daily cap 25.</span>
          </span>
        </label>
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-line p-4 opacity-80">
          <input type="radio" name="mailbox" className="mt-1" disabled aria-describedby="gmail-note" />
          <span>
            <span className="text-sm font-semibold text-ink">Gmail</span> <Badge tone="outline">Private beta</Badge>
            <span id="gmail-note" className="mt-0.5 block text-[13px] leading-5 text-slate">
              Connect with Google OAuth using the narrowest permissions needed. Tokens are stored encrypted on the server. Not available in the demo.
            </span>
          </span>
        </div>
      </fieldset>
    </SectionCard>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ScheduleStep({ c, editable }: { c: Campaign; editable: boolean }) {
  const sc = c.schedule;
  const set = (patch: Partial<Campaign["schedule"]>) => demo.updateCampaign(c.id, { schedule: { ...sc, ...patch } });
  return (
    <SectionCard title="Schedule" description="Sends only inside these hours in the chosen time zone. Daylight-saving changes follow the time zone.">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tz">Time zone</Label>
          <Select id="tz" value={sc.timezone} disabled={!editable} onChange={(e) => set({ timezone: e.target.value })}>
            {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Australia/Sydney"].map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cap">Daily cap for this mailbox</Label>
          <Input id="cap" type="number" min={1} max={50} value={sc.dailyCap} disabled={!editable} onChange={(e) => set({ dailyCap: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
          <FieldHint>Conservative caps protect your mailbox. Maximum 50 in the demo.</FieldHint>
        </div>
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="text-[13px] font-medium text-ink">Sending days</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = sc.days.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  disabled={!editable}
                  onClick={() => set({ days: on ? sc.days.filter((x) => x !== i) : [...sc.days, i].sort() })}
                  className={cn(
                    "h-9 w-12 rounded-lg border text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
                    on ? "border-green bg-green text-white" : "border-line-strong/50 bg-surface text-slate hover:text-ink",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="start">Start hour</Label>
          <Select id="start" value={sc.startHour} disabled={!editable} onChange={(e) => set({ startHour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">End hour</Label>
          <Select id="end" value={sc.endHour} disabled={!editable} onChange={(e) => set({ endHour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
          {sc.endHour <= sc.startHour ? <p className="text-xs font-medium text-danger-fg">End must be after start.</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function ReviewStep({ c, checks, onGo }: { c: Campaign; checks: Record<StepId, boolean>; onGo: (s: StepId) => void }) {
  const s = useDemo();
  const { push } = useToast();
  const elig = evaluateRecipients(s, c);
  const eligible = elig.filter((e) => e.eligible);
  const excluded = elig.filter((e) => !e.eligible);
  const approved = approvalValid(c);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const enrollments = s.enrollments.filter((e) => e.campaignId === c.id);
  const ready = (["audience", "offer", "sequence", "mailbox", "schedule"] as StepId[]).every((k) => checks[k]);

  return (
    <div className="space-y-5">
      {c.status === "draft" ? (
        <SectionCard title="Approve this version" description="Approval covers these exact recipients, drafts, follow-ups and schedule. Any later change removes it.">
          <ul className="mb-4 grid gap-2 sm:grid-cols-2">
            {(["audience", "offer", "sequence", "mailbox", "schedule"] as StepId[]).map((k) => (
              <li key={k}>
                <button type="button" onClick={() => onGo(k)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-canvas">
                  {checks[k] ? <CheckCircle2 aria-hidden className="size-4 text-green" /> : <CircleAlert aria-hidden className="size-4 text-warn-fg" />}
                  <span className="capitalize text-ink">{k}</span>
                  <span className="text-xs text-slate">{checks[k] ? "Ready" : "Needs attention"}</span>
                </button>
              </li>
            ))}
          </ul>
          {approved ? (
            <Callout tone="green" icon={<CheckCircle2 />} title={`Approved revision ${c.approval!.revision}`}>
              Approved {formatDateTime(c.approval!.approvedAt)} UTC for {c.approval!.recipientIds.length} recipient{c.approval!.recipientIds.length === 1 ? "" : "s"}.
            </Callout>
          ) : c.approval ? (
            <Callout tone="warn" icon={<CircleAlert />} title="Approval out of date">
              Something changed after approval (revision {c.approval.revision} → {c.revision}). Review and approve again.
            </Callout>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {approved ? null : <Button disabled={!ready} onClick={() => {
                const r = demo.approveCampaign(c.id);
                push(r.ok ? { tone: "success", title: `Approved revision ${c.revision}` } : { tone: "error", title: "Can't approve yet", body: r.reason });
              }}>
              <ShieldCheck aria-hidden /> Approve revision {c.revision}
            </Button>}
            <Button
              disabled={!approved}
              onClick={() => {
                const r = demo.simulateLaunch(c.id);
                push(r.ok ? { tone: "info", title: "Simulated launch started", body: "Messages are marked as sent one by one. Nothing leaves your browser." } : { tone: "error", title: "Can't launch", body: r.reason });
              }}
            >
              <FlaskConical aria-hidden /> Simulate launch
            </Button>
          </div>
          {!ready ? <p className="mt-2 text-xs text-slate">Complete the steps marked “Needs attention” first.</p> : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title={c.status === "draft" ? "Messages in this version" : "Recipients"}
        description={c.status === "draft" ? `${eligible.length} will receive the first email. ${excluded.length} excluded.` : "State per recipient. Follow-ups stop on reply."}
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-line">
          {(c.status === "draft" ? elig : c.leadIds.map((id) => elig.find((e) => e.leadId === id)!)).map((e) => {
            const d = s.drafts[e.leadId];
            const enr = enrollments.find((x) => x.leadId === e.leadId);
            const approvedVersion = c.approval?.draftVersions[e.leadId];
            return (
              <li key={e.leadId} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{e.name}</span>
                  {enr ? (
                    <Badge tone={enr.state === "replied" ? "green" : enr.state === "stopped" ? "neutral" : enr.state === "sent" ? "info" : "outline"}>
                      {enr.state === "sent" ? "Sent (simulated)" : enr.state}
                    </Badge>
                  ) : e.eligible ? (
                    <Badge tone="green">Eligible</Badge>
                  ) : (
                    <Badge tone="danger">Excluded: {e.reason}</Badge>
                  )}
                  {d ? (
                    <span className="text-xs text-slate">
                      Draft v{d.version}
                      {approvedVersion ? ` · approved v${approvedVersion}` : ""}
                    </span>
                  ) : null}
                  {d ? (
                    <button type="button" className="ml-auto text-xs font-medium text-green hover:underline" aria-expanded={expanded === e.leadId} onClick={() => setExpanded(expanded === e.leadId ? null : e.leadId)}>
                      {expanded === e.leadId ? "Hide message" : "Show message"}
                    </button>
                  ) : null}
                </div>
                {enr?.reason ? <p className="mt-1 text-xs text-slate">{enr.reason}</p> : null}
                {expanded === e.leadId && d ? (
                  <div className="mt-2 rounded-[10px] border border-line bg-canvas/60 p-3">
                    <p className="text-[13px]">
                      <span className="text-slate">Subject: </span>
                      <span className="font-medium text-ink">{d.subject}</span>
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-6 text-ink">{d.body}</pre>
                  </div>
                ) : null}
              </li>
            );
          })}
          {!elig.length ? <li className="px-5 py-6 text-sm text-slate">No recipients.</li> : null}
        </ul>
      </SectionCard>
    </div>
  );
}
