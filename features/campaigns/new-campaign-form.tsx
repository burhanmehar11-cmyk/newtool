"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Callout, EmptyState } from "@/components/ui/misc";
import { EmailStatusBadge } from "@/components/product/badges";
import type { EmailStatus } from "@/lib/domain/types";
import { createCampaignAction } from "@/server/actions/campaigns";
import type { EligibleLead } from "@/server/campaign-store";
import type { MailboxRow } from "@/server/mailbox-store";

export function NewCampaignForm({ leads, mailboxes, hasOffer }: { leads: EligibleLead[]; mailboxes: MailboxRow[]; hasOffer: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  if (!hasOffer)
    return (
      <Callout tone="warn" title="Add your offer profile first">
        Messages are written from what you sell and who signs them. <Link href="/app/settings">Open Settings</Link>.
      </Callout>
    );
  if (!mailboxes.length)
    return (
      <Callout tone="warn" title="Connect a mailbox first">
        Campaigns send from your own Gmail address. <Link href="/app/mailboxes">Connect Gmail</Link>.
      </Callout>
    );
  if (!leads.length)
    return (
      <EmptyState title="No leads ready yet" action={<Button asChild><Link href="/app/leads">Open leads</Link></Button>}>
        A lead can join a campaign once a public email address is known. Search Google Maps (results come with emails) or import a CSV in Leads.
      </EmptyState>
    );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const r = await createCampaignAction({ name: String(fd.get("name") ?? ""), mailboxId: String(fd.get("mailboxId") ?? ""), leadIds: selected });
          if (r.ok) router.push(`/app/campaigns/${r.id}`);
          else setError(r.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Campaign name</Label>
          <Input id="c-name" name="name" required minLength={2} maxLength={120} placeholder="e.g. Austin dentists, November" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-mailbox">Send from</Label>
          <Select id="c-mailbox" name="mailboxId" defaultValue={mailboxes[0].id}>
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.sender_name ? `${m.sender_name} <${m.email}>` : m.email} · {m.daily_cap}/day
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Leads ({selected.length} of {leads.length} selected)</Label>
          <button type="button" className="text-xs font-medium text-green hover:underline" onClick={() => setSelected(selected.length === leads.length ? [] : leads.map((l) => l.lead_id))}>
            {selected.length === leads.length ? "Clear" : "Select all"}
          </button>
        </div>
        <ul className="mt-2 max-h-[420px] divide-y divide-line overflow-y-auto rounded-xl border border-line scrollbar-thin">
          {leads.map((l) => {
            const on = selected.includes(l.lead_id);
            return (
              <li key={l.lead_id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-canvas">
                  <Checkbox checked={on} onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== l.lead_id) : [...xs, l.lead_id]))} aria-label={`Include ${l.name}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{l.name}</span>
                    <span className="block truncate font-mono text-xs text-slate">{l.email}</span>
                  </span>
                  <EmailStatusBadge status={l.email_status as EmailStatus} />
                </label>
              </li>
            );
          })}
        </ul>
        <FieldHint className="mt-2">Leads with a public email are listed. Ones not researched yet have their website read when you create the campaign (this can take up to a minute). Leads already in an active campaign or on the do-not-contact list are left out.</FieldHint>
      </div>

      {error ? <Callout tone="danger">{error}</Callout> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !selected.length}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null} Create draft campaign
        </Button>
        <p className="text-xs text-slate">Writes a first message for each lead from its research. Nothing is sent until you review and approve.</p>
      </div>
    </form>
  );
}
