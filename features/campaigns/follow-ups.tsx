"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Plus, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { DEFAULT_FOLLOW_UPS, DELAY_MAX, DELAY_MIN, MAX_FOLLOW_UPS, followUpProblem, sendDays, type FollowUp } from "@/lib/campaigns/followups";
import { saveFollowUpsAction } from "@/server/actions/campaigns";

function Timeline({ steps }: { steps: FollowUp[] }) {
  const days = sendDays(steps);
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate">
      {days.map((d, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="h-px w-4 bg-line-strong/60" /> : null}
          <span className={i === 0 ? "rounded-full bg-mint-soft px-2 py-0.5 font-medium text-green" : "rounded-full border border-line px-2 py-0.5"}>
            {i === 0 ? "First email" : `Follow-up ${i}`} · day {d}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Draft campaigns: edit up to two follow-ups. Saving moves the revision on, so the campaign is approved again. */
export function FollowUpsEditor({ campaignId, initial, canManage }: { campaignId: string; initial: FollowUp[]; canManage: boolean }) {
  const router = useRouter();
  const [steps, setSteps] = React.useState<FollowUp[]>(initial);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = React.useTransition();
  const dirty = JSON.stringify(steps) !== JSON.stringify(initial);
  const problem = followUpProblem(steps);
  const set = (i: number, patch: Partial<FollowUp>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
          <Repeat aria-hidden className="size-[18px]" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Follow-ups</h2>
          <p className="mt-0.5 text-[13px] leading-5 text-slate">Short notes sent in the same thread to people who haven&apos;t answered. Any reply, unsubscribe or bounce stops them.</p>
        </div>
      </div>
      <Timeline steps={steps} />
      {steps.map((s, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-line p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <CornerDownRight aria-hidden className="size-4 text-green" /> Follow-up {i + 1}
            </p>
            {canManage ? (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-slate hover:text-danger-fg" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden className="size-3.5" /> Remove
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`fu-delay-${i}`} className="mb-0 shrink-0 text-[13px] font-normal text-slate">
              Wait
            </Label>
            <Input
              id={`fu-delay-${i}`}
              type="number"
              min={DELAY_MIN}
              max={DELAY_MAX}
              className="h-9 w-20"
              value={s.delayDays}
              disabled={!canManage}
              onChange={(e) => set(i, { delayDays: Math.round(Number(e.target.value) || 0) })}
            />
            <span className="text-[13px] text-slate">days after the {i === 0 ? "first email" : "previous follow-up"}</span>
          </div>
          <Label htmlFor={`fu-body-${i}`} className="sr-only">
            Follow-up {i + 1} message
          </Label>
          <Textarea id={`fu-body-${i}`} rows={4} value={s.body} disabled={!canManage} onChange={(e) => set(i, { body: e.target.value })} />
        </div>
      ))}
      <FieldHint>
        <code className="font-mono">{"{business}"}</code> becomes each business&apos;s name and <code className="font-mono">{"{sender}"}</code> your from name. The subject is &quot;Re:&quot; plus the first email&apos;s, and the unsubscribe footer is added to every email.
      </FieldHint>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {steps.length < MAX_FOLLOW_UPS ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setSteps((x) => [...x, DEFAULT_FOLLOW_UPS[x.length] ?? DEFAULT_FOLLOW_UPS[0]])}>
              <Plus aria-hidden /> Add follow-up
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!dirty || !!problem || pending}
            onClick={() =>
              start(async () => {
                setMsg(null);
                const r = await saveFollowUpsAction(campaignId, steps);
                setMsg(r.ok ? { ok: true, text: steps.length ? "Follow-ups saved. Review and approve the campaign again." : "Follow-ups removed." } : { ok: false, text: r.error });
                router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Save follow-ups"}
          </Button>
        </div>
      ) : null}
      {dirty && problem ? <FieldError>{problem}</FieldError> : null}
      {msg ? (
        <Callout tone={msg.ok ? "green" : "danger"} className="py-1.5">
          <span role="status">{msg.text}</span>
        </Callout>
      ) : null}
    </section>
  );
}

/** Approved campaigns: what follow-ups will go out, read-only. */
export function FollowUpsSummary({ steps }: { steps: FollowUp[] }) {
  if (!steps.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Repeat aria-hidden className="size-4 text-green" /> Follow-ups
      </h2>
      <Timeline steps={steps} />
      <ul className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="rounded-xl border border-line p-3 text-[13px] leading-5 text-ink/90">
            <p className="mb-1 text-xs font-medium text-slate">
              Follow-up {i + 1} · {s.delayDays} day{s.delayDays === 1 ? "" : "s"} later
            </p>
            <p className="whitespace-pre-line">{s.body}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate">Only to people who haven&apos;t replied, unsubscribed or bounced.</p>
    </section>
  );
}
