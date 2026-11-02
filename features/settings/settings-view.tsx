"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleDashed, FlaskConical, Mail, ShieldBan, Trash2 } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Callout, EmptyState, Meter } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { demo, useDemo } from "@/demo/store";
import { usageSummary } from "@/demo/selectors";
import { emptyOfferTemplate } from "@/demo/seed";
import { offerProfileSchema, type OfferProfileInput } from "@/lib/domain/schemas";
import { usageUnitDefinitions } from "@/config/plans";
import { features, availabilityLabel } from "@/config/milestone";
import { formatDateTime } from "@/lib/utils";
import { OfferFields } from "./offer-fields";

const TABS = ["organization", "offer", "sending", "suppression", "usage", "connections"] as const;
type Tab = (typeof TABS)[number];

export function SettingsView() {
  const [tab, setTab] = React.useState<Tab>("organization");

  // Deep links such as /demo/settings#usage
  React.useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "");
      if ((TABS as readonly string[]).includes(h)) setTab(h as Tab);
    };
    const t = window.setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, []);

  return (
    <div>
      <PageHeader title="Settings" description="Workspace details, your offer, sending, suppression and usage." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-thin sm:mx-0 sm:px-0">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="offer">Offer profile</TabsTrigger>
            <TabsTrigger value="sending">Sending accounts</TabsTrigger>
            <TabsTrigger value="suppression">Suppression</TabsTrigger>
            <TabsTrigger value="usage">Usage & billing</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
          </TabsList>
        </div>
        <div className="mt-5">
          <TabsContent value="organization">
            <OrganizationTab />
          </TabsContent>
          <TabsContent value="offer">
            <OfferTab />
          </TabsContent>
          <TabsContent value="sending">
            <SendingTab />
          </TabsContent>
          <TabsContent value="suppression">
            <SuppressionTab />
          </TabsContent>
          <TabsContent value="usage">
            <UsageTab />
          </TabsContent>
          <TabsContent value="connections">
            <ConnectionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

const orgSchema = z.object({ name: z.string().trim().min(2, "At least 2 characters.").max(80) });

function OrganizationTab() {
  const s = useDemo();
  const { push } = useToast();
  const form = useForm<z.infer<typeof orgSchema>>({ resolver: zodResolver(orgSchema), values: { name: s.workspace.name } });
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="Workspace">
        <form
          onSubmit={form.handleSubmit((v) => {
            demo.updateWorkspaceName(v.name);
            push({ tone: "success", title: "Workspace renamed" });
          })}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </div>
          <Button type="submit" disabled={!form.formState.isDirty}>
            Save
          </Button>
        </form>
      </SectionCard>
      <SectionCard title="Team and client workspaces">
        <div className="space-y-3 text-sm">
          {(["roles", "multiWorkspace"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-[10px] border border-dashed border-line p-3">
              <span className="text-ink">{features[k].label}</span>
              <Badge tone="outline">{availabilityLabel(features[k].availability)}</Badge>
            </div>
          ))}
          <p className="text-xs leading-5 text-slate">Owner, admin, operator and viewer roles and separate client workspaces are planned for launch. The demo has a single local workspace.</p>
        </div>
      </SectionCard>
    </div>
  );
}

function OfferTab() {
  const s = useDemo();
  const { push } = useToast();
  const form = useForm<OfferProfileInput>({ resolver: zodResolver(offerProfileSchema), values: s.offer ?? emptyOfferTemplate });
  const watchedType = useWatch({ control: form.control, name: "serviceType" });
  const typeChanged = s.offer && watchedType !== s.offer.serviceType;
  return (
    <SectionCard title="Offer profile" description="Used to score Opportunity Briefs and write drafts. Changing the offer type marks existing briefs as outdated.">
      <form
        onSubmit={form.handleSubmit((v) => {
          demo.updateOffer(v);
          push({ tone: "success", title: "Offer profile saved" });
        })}
        className="space-y-5"
        noValidate
      >
        <OfferFields
          register={form.register}
          errors={form.formState.errors}
          fields={["serviceType", "service", "targetCustomer", "valueProp", "tone", "senderName", "senderTitle", "companyName", "businessAddress", "bookingLink"]}
        />
        {typeChanged ? <Callout tone="warn">Briefs already generated will be marked outdated until you research again.</Callout> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={!form.formState.isDirty}>
            Save offer profile
          </Button>
          <Button type="button" variant="secondary" disabled={!form.formState.isDirty} onClick={() => form.reset()}>
            Discard changes
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function SendingTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SectionCard title="Connected mailboxes">
        <ul className="space-y-3">
          <li className="flex items-start gap-3 rounded-[12px] border border-line p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-demo-bg text-demo-fg">
              <FlaskConical aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Demo mailbox</p>
              <p className="text-[13px] leading-5 text-slate">Simulated. Accepts messages and delivers nothing. Daily cap 25.</p>
            </div>
            <Badge tone="demo">Simulated</Badge>
          </li>
          <li className="flex items-start gap-3 rounded-[12px] border border-dashed border-line p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-canvas text-slate">
              <Mail aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Gmail</p>
              <p className="text-[13px] leading-5 text-slate">Connect with Google, separately from your sign-in, using the narrowest permissions needed. Tokens are encrypted server-side and can be disconnected at any time.</p>
            </div>
            <Badge tone="outline">Private beta</Badge>
          </li>
        </ul>
        <p className="mt-4 text-xs leading-5 text-slate">Outlook and IMAP mailboxes are on the later backlog.</p>
      </SectionCard>
      <SectionCard title="Sending safeguards">
        <ul className="space-y-2.5 text-sm text-ink">
          {[
            "Per-mailbox daily caps and business-hours schedules",
            "Status, approval, suppression and reply checks run again right before each send",
            "Follow-ups stop on reply, unsubscribe, hard bounce or manual exclusion",
            "A visible opt-out line in every message",
            "No open tracking in the beta",
          ].map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-green" />
              {x}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-5 text-slate">Deliverability can&apos;t be guaranteed. Outreach rules vary by market; you remain responsible for meeting them.</p>
      </SectionCard>
    </div>
  );
}

function SuppressionTab() {
  const s = useDemo();
  const { push } = useToast();
  const [value, setValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <SectionCard title="Suppression list" description="Applies to the whole workspace, including future imports. Re-importing a lead never removes it from this list." bodyClassName="p-0">
      <form
        className="grid gap-3 border-b border-line p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const r = demo.addSuppression(value, note);
          if (!r.ok) return setErr(r.reason ?? "Couldn't add.");
          setErr(null);
          setValue("");
          setNote("");
          push({ tone: "success", title: "Added to suppression list", body: "Queued messages to this address were stopped." });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="sup-value">Email or domain</Label>
          <Input id="sup-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="name@example.com or example.com" aria-invalid={!!err} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sup-note">Note (optional)</Label>
          <Input id="sup-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. existing client" />
        </div>
        <Button type="submit" disabled={!value.trim()}>
          <ShieldBan aria-hidden /> Add
        </Button>
        <FieldError className="sm:col-span-3">{err}</FieldError>
      </form>
      {s.suppression.length ? (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Suppressed addresses and domains</caption>
            <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-medium">Address or domain</th>
                <th scope="col" className="py-2.5 pr-3 font-medium">Reason</th>
                <th scope="col" className="py-2.5 pr-3 font-medium">Added</th>
                <th scope="col" className="py-2.5 pr-5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.suppression.map((x) => (
                <tr key={x.id} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-3">
                    <span className="font-mono text-[13px] text-ink">{x.value}</span>
                    <span className="ml-2 text-xs text-slate">{x.kind}</span>
                  </td>
                  <td className="py-3 pr-3 text-[13px]">
                    <Badge tone={x.reason === "unsubscribe" ? "danger" : "neutral"}>{x.reason}</Badge>
                    {x.note ? <span className="ml-2 text-slate">{x.note}</span> : null}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate">{formatDateTime(x.addedAt)}</td>
                  <td className="py-3 pr-5 text-right">
                    {x.reason === "unsubscribe" ? (
                      <span className="text-xs text-slate" title="Opt-outs are kept so they keep being honoured.">
                        Kept
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => demo.removeSuppression(x.id)} aria-label={`Remove ${x.value}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState icon={<ShieldBan />} title="No suppressed addresses">
            Unsubscribes and addresses you add manually appear here.
          </EmptyState>
        </div>
      )}
    </SectionCard>
  );
}

function UsageTab() {
  const s = useDemo();
  const u = usageSummary(s);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-3">
        {(
          [
            ["discovery", "Discovery", usageUnitDefinitions.discoveryUnits],
            ["verification", "Verification", usageUnitDefinitions.verificationUnits],
            ["ai", "AI research and drafts", usageUnitDefinitions.aiUnits],
          ] as const
        ).map(([k, label, def]) => (
          <div key={k} className="card p-5">
            <Meter label={label} used={u[k].used} total={u[k].allowance} />
            <p className="mt-3 text-xs leading-5 text-slate">{def}</p>
            {u[k].reserved ? <p className="mt-1 text-xs font-medium text-info-fg">{u[k].reserved} reserved for running work</p> : null}
          </div>
        ))}
      </div>
      <Callout tone="demo" icon={<FlaskConical />}>
        This is a demo allowance, not a plan limit. Billing arrives with paid plans, and prices have not been set.
      </Callout>
      <SectionCard title="Usage ledger" description="Reservations are held while work runs; unused units are released. Retries of the same check are not charged twice." bodyClassName="p-0">
        {s.usage.length ? (
          <div className="max-h-[480px] overflow-auto scrollbar-thin">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Usage ledger</caption>
              <thead className="sticky top-0 border-b border-line bg-surface text-xs text-slate">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">When (UTC)</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Type</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Description</th>
                  <th scope="col" className="py-2.5 pr-5 text-right font-medium">Units</th>
                </tr>
              </thead>
              <tbody>
                {s.usage.map((x) => (
                  <tr key={x.id} className="border-b border-line last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate">{formatDateTime(x.at)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={x.type === "charge" ? "neutral" : x.type === "release" ? "green" : "info"}>
                        {x.kind} · {x.type}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] text-ink">{x.note}</td>
                    <td className="py-2.5 pr-5 text-right tabular-nums">
                      {x.type === "release" ? "−" : x.type === "reserve" ? "(" : ""}
                      {x.units}
                      {x.type === "reserve" ? ")" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="No usage yet">Searches, verifications and AI drafts will be recorded here.</EmptyState>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ConnectionsTab() {
  const rows = [
    { label: "Business discovery", demo: "Fictional fixtures", live: "One licensed provider, chosen after a terms review", k: "discovery" as const },
    { label: "Email verification", demo: "Pre-set sample outcomes", live: "One verification provider", k: "verification" as const },
    { label: "AI research and drafts", demo: "Fixed templates, no model calls", live: "Anthropic, server-side only", k: "opportunityBrief" as const },
    { label: "Mailbox", demo: "Simulated mailbox", live: "Gmail OAuth", k: "gmail" as const },
    { label: "Billing", demo: "None", live: "Billing provider (to be confirmed)", k: "billing" as const },
    { label: "REST API and webhooks", demo: "None", live: "Scoped keys, signed webhooks", k: "api" as const },
    { label: "MCP integration", demo: "None", live: "Inspection, drafts and pause tools", k: "mcp" as const },
  ];
  return (
    <SectionCard title="Connection status" description="What powers each capability today, and what will power it live." bodyClassName="p-0">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Provider connection status</caption>
          <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium">Capability</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">In this demo</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Live version</th>
              <th scope="col" className="py-2.5 pr-5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-b-0">
                <td className="px-5 py-3 font-medium text-ink">{r.label}</td>
                <td className="py-3 pr-3 text-[13px] text-slate">{r.demo}</td>
                <td className="py-3 pr-3 text-[13px] text-slate">{r.live}</td>
                <td className="py-3 pr-5">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-slate">
                    <CircleDashed aria-hidden className="size-3.5" /> Not connected · planned for {features[r.k].target === "M2" ? "private beta" : "launch"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-slate">
        No production provider is connected in this build. Nothing in the demo makes a network request to a provider.
      </p>
    </SectionCard>
  );
}
