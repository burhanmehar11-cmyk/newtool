"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookmarkPlus,
  Building2,
  ExternalLink,
  FileSearch,
  Globe,
  History,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  RefreshCw,
  Sparkles,
  Star,
  Tag,
  X,
} from "lucide-react";
import { Dialog, SheetCloseButton, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/field";
import { Callout, EmptyState, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { EvidenceItem } from "@/components/product/evidence";
import { EmailStatusBadge, FitBadge, NoEmailBadge, SampleBadge, emailStatusMeta } from "@/components/product/badges";
import { OpportunityBriefView } from "@/components/product/opportunity-brief";
import { demo, useDemo } from "@/demo/store";
import { briefIsStale, contactsOf, getBiz, leadStage } from "@/demo/selectors";
import { nicheById } from "@/demo/fixtures/catalog";
import { formatDate, formatDateTime } from "@/lib/utils";
import { CampaignStatusBadge } from "@/features/campaigns/status";
import { AddToCampaignDialog } from "./add-to-campaign";

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const open = !!leadId;
  // Close if this route is hidden by a navigation.
  const closeRef = React.useRef(onClose);
  React.useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  React.useLayoutEffect(() => () => closeRef.current(), []);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {leadId ? (
        <SheetContent title="Lead details" side="right" className="max-w-[min(100vw,640px)]">
          <LeadDrawerBody key={leadId} leadId={leadId} />
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function LeadDrawerBody({ leadId }: { leadId: string }) {
  const s = useDemo();
  const { push } = useToast();
  const b = getBiz(s, leadId);
  const [tab, setTab] = React.useState("brief");
  const [addOpen, setAddOpen] = React.useState(false);
  if (!b) {
    return (
      <div className="p-6">
        <EmptyState title="Lead not found">It may have been removed. Close this panel to continue.</EmptyState>
      </div>
    );
  }
  const saved = !!s.leads[leadId];
  const brief = s.briefs[leadId];
  const researching = s.researching.includes(leadId);
  const stage = leadStage(s, leadId);
  const niche = nicheById(b.niche);

  const run = (r: { ok: boolean; reason?: string }, success?: string) => {
    if (!r.ok) push({ tone: "error", title: "Couldn't do that", body: r.reason });
    else if (success) push({ tone: "info", title: success });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line px-5 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
            <Building2 aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold text-ink">{b.name}</h2>
            <p className="text-[13px] text-slate">
              {b.provider.name === "CSV import" ? "Imported" : niche?.label} · {b.city}
              {b.region ? `, ${b.region}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {b.provider.name === "Demo fixtures" ? <SampleBadge /> : <Badge tone="outline">CSV import</Badge>}
              <Badge tone={saved ? "green" : "outline"}>{saved ? "In Leads" : "Not saved"}</Badge>
              {saved ? <Badge tone="neutral">{stage}</Badge> : null}
              {brief ? <FitBadge level={brief.fit.level} stale={briefIsStale(s, leadId)} /> : null}
            </div>
          </div>
          <SheetCloseButton />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!saved ? (
            <Button size="sm" variant="secondary" onClick={() => {
                demo.saveLeads([leadId]);
                push({ tone: "success", title: "Saved to Leads" });
              }}>
              <BookmarkPlus aria-hidden /> Save to Leads
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={brief ? "secondary" : "primary"}
            disabled={researching}
            onClick={() => {
              setTab("brief");
              run(demo.research(leadId));
            }}
          >
            {researching ? <Loader2 aria-hidden className="animate-spin" /> : <FileSearch aria-hidden />}
            {researching ? "Researching…" : brief ? "Research again" : "Research"}
          </Button>
          <Button size="sm" variant="secondary" disabled={!saved} onClick={() => setAddOpen(true)} title={saved ? undefined : "Save the lead first"}>
            <Megaphone aria-hidden /> Add to campaign
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line px-5 py-2.5">
          <TabsList aria-label="Lead sections" className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <TabsContent value="brief">
            {researching ? (
              <div className="space-y-3" aria-busy="true" aria-live="polite">
                <p className="text-sm text-slate">Reading collected sources and checking them against your offer…</p>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : brief ? (
              <>
                {briefIsStale(s, leadId) ? (
                  <Callout tone="warn" className="mb-4" title="Researched for a different offer">
                    Your offer profile changed since this brief was generated. Research again to re-score it.
                  </Callout>
                ) : null}
                <OpportunityBriefView brief={brief} business={b} stale={briefIsStale(s, leadId)} onEvidenceOpen={() => demo.markEvidenceInspected()} />
              </>
            ) : (
              <EmptyState
                icon={<FileSearch />}
                title="Not researched yet"
                action={
                  <Button size="sm" onClick={() => run(demo.research(leadId))}>
                    Research this lead · 1 AI unit
                  </Button>
                }
              >
                The brief lists what was observed on public sources, possible opportunities for your offer, and what is unknown.
                {!s.offer ? " Set up your offer profile first." : ""}
              </EmptyState>
            )}
          </TabsContent>

          <TabsContent value="draft">
            <DraftEditor leadId={leadId} onNeedBrief={() => setTab("brief")} />
          </TabsContent>

          <TabsContent value="details">
            <DetailsTab leadId={leadId} />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignHistory leadId={leadId} onAdd={() => setAddOpen(true)} saved={saved} />
          </TabsContent>
        </div>
      </Tabs>

      <AddToCampaignDialog leadIds={[leadId]} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function DraftEditor({ leadId, onNeedBrief }: { leadId: string; onNeedBrief: () => void }) {
  const s = useDemo();
  const { push } = useToast();
  const draft = s.drafts[leadId];
  const brief = s.briefs[leadId];
  const [subject, setSubject] = React.useState(draft?.subject ?? "");
  const [body, setBody] = React.useState(draft?.body ?? "");
  const [syncedVersion, setSyncedVersion] = React.useState(draft?.version ?? 0);
  const [showHistory, setShowHistory] = React.useState(false);

  // Adopt the stored draft whenever a new version appears (render-time sync, no effect).
  if ((draft?.version ?? 0) !== syncedVersion) {
    setSyncedVersion(draft?.version ?? 0);
    setSubject(draft?.subject ?? "");
    setBody(draft?.body ?? "");
  }

  if (!brief) {
    return (
      <EmptyState icon={<Sparkles />} title="Research first" action={<Button size="sm" variant="secondary" onClick={onNeedBrief}>Go to brief</Button>}>
        Drafts are written from the Opportunity Brief, so each opening line can point to a specific fact.
      </EmptyState>
    );
  }
  if (!draft) {
    return (
      <EmptyState
        icon={<Mail />}
        title="No draft yet"
        action={
          <Button
            size="sm"
            onClick={() => {
              const r = demo.generateDraft(leadId);
              if (!r.ok) push({ tone: "error", title: "Couldn't generate a draft", body: r.reason });
            }}
          >
            <Sparkles aria-hidden /> Generate draft · 1 AI unit
          </Button>
        }
      >
        A first draft built from the strongest observed fact. You can edit everything before approving.
      </EmptyState>
    );
  }

  const dirty = subject !== draft.subject || body !== draft.body;
  const facts = brief.facts.filter((f) => draft.factIds.includes(f.id));
  const inCampaign = s.campaigns.some((c) => c.leadIds.includes(leadId) && c.approval && c.status !== "cancelled");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
        <Badge tone={draft.origin === "edited" ? "info" : "outline"}>
          v{draft.version} · {draft.origin === "edited" ? "edited by you" : "generated"}
        </Badge>
        <span>Updated {formatDateTime(draft.updatedAt)} UTC</span>
        <span className="text-slate">· Not sent</span>
      </div>
      {inCampaign ? (
        <Callout tone="info">Saving changes removes approval from campaigns that include this lead. You&apos;ll review them again before anything is sent.</Callout>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`subj-${leadId}`}>Subject</Label>
        <Input id={`subj-${leadId}`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`body-${leadId}`}>Body</Label>
        <Textarea id={`body-${leadId}`} value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-sans text-[13.5px]" />
        <FieldHint>Keep the opt-out line. The sender identity and address come from your offer profile.</FieldHint>
      </div>
      <div className="rounded-[10px] bg-canvas px-3 py-2.5 text-xs text-slate">
        <span className="font-medium text-ink">Grounded in: </span>
        {facts.length ? facts.map((f) => f.text).join(" · ") : "No specific fact. Consider whether this lead is worth contacting."}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!dirty || !subject.trim() || !body.trim()}
          onClick={() => {
            demo.saveDraft(leadId, subject.trim(), body);
            push({ tone: "success", title: `Saved as v${draft.version + 1}` });
          }}
        >
          Save changes
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty}
          onClick={() => {
            setSubject(draft.subject);
            setBody(draft.body);
          }}
        >
          Discard
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const r = demo.generateDraft(leadId);
            if (!r.ok) push({ tone: "error", title: "Couldn't generate a draft", body: r.reason });
          }}
        >
          <RefreshCw aria-hidden /> Try another angle · 1 AI unit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
          <History aria-hidden /> History ({draft.history.length})
        </Button>
      </div>
      {showHistory ? (
        <ol className="space-y-1.5 rounded-[10px] border border-line p-3 text-[13px]">
          {[...draft.history].reverse().map((h) => (
            <li key={h.version} className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums text-ink">v{h.version}</span>
              <span className="text-slate">{h.origin}</span>
              <span className="min-w-0 flex-1 truncate text-slate">{h.subject}</span>
              <span className="text-xs text-slate">{formatDateTime(h.at)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function DetailsTab({ leadId }: { leadId: string }) {
  const s = useDemo();
  const { push } = useToast();
  const b = getBiz(s, leadId)!;
  const lead = s.leads[leadId];
  const contacts = contactsOf(s, b);
  const [notes, setNotes] = React.useState(lead?.notes ?? "");
  const [tag, setTag] = React.useState("");

  const facts: [React.ReactNode, React.ReactNode][] = [
    [<MapPin key="i" aria-hidden className="size-3.5" />, b.address],
    [<Phone key="i" aria-hidden className="size-3.5" />, b.phone],
    [<Globe key="i" aria-hidden className="size-3.5" />, b.domain ? <span className="font-mono text-[13px]">{b.domain}</span> : "No website listed"],
    [<Star key="i" aria-hidden className="size-3.5" />, b.rating !== null ? `${b.rating.toFixed(1)} rating · ${b.reviewCount} reviews` : "Rating: Unknown"],
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 font-sans text-[13px] font-semibold text-ink">Business</h3>
        <ul className="space-y-1.5 text-sm text-ink">
          {facts.map(([icon, text], i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="text-slate">{icon}</span>
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate">
          Source: {b.provider.name} · collected {formatDate(b.collectedAt)}
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-sans text-[13px] font-semibold text-ink">Contact</h3>
        {contacts.length ? (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="rounded-[10px] border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] text-ink">{c.email}</span>
                  <EmailStatusBadge status={c.status} verifying={c.verifying} suppressed={c.suppressed} />
                  <span className="text-xs text-slate">Role address</span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-slate">{emailStatusMeta[c.status].help}</p>
                <p className="mt-1 text-xs text-slate">
                  {c.verifiedAt ? `Checked by ${c.verificationProvider} on ${formatDate(c.verifiedAt)}.` : "Found on the contact page."}
                </p>
                {c.status === "unverified" && !c.suppressed ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2.5"
                    disabled={c.verifying}
                    onClick={() => {
                      const r = demo.verify([c.id]);
                      if (!r.ok) push({ tone: "error", title: "Couldn't verify", body: r.reason });
                    }}
                  >
                    {c.verifying ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
                    {c.verifying ? "Checking…" : "Verify · 1 unit"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate">
            <NoEmailBadge /> No public email was found on the pages checked. Named people are never guessed.
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-sans text-[13px] font-semibold text-ink">Sources</h3>
        {b.evidence.length ? (
          <div className="space-y-1.5">
            {b.evidence.map((e) => (
              <EvidenceItem key={e.id} evidence={e} onOpen={() => demo.markEvidenceInspected()} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate">No sources collected.</p>
        )}
      </section>

      {lead ? (
        <>
          <section>
            <h3 className="mb-2 font-sans text-[13px] font-semibold text-ink">Lists and tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {lead.listIds.map((lid) => {
                const l = s.lists.find((x) => x.id === lid);
                return l ? (
                  <Badge key={lid} tone="info">
                    {l.name}
                    <button type="button" onClick={() => demo.removeFromList(leadId, lid)} className="-mr-0.5 rounded hover:bg-info-fg/10" aria-label={`Remove from ${l.name}`}>
                      <X aria-hidden />
                    </button>
                  </Badge>
                ) : null;
              })}
              {lead.tags.map((t) => (
                <Badge key={t} tone="neutral">
                  <Tag aria-hidden /> {t}
                  <button type="button" onClick={() => demo.removeTag(leadId, t)} className="-mr-0.5 rounded hover:bg-ink/10" aria-label={`Remove tag ${t}`}>
                    <X aria-hidden />
                  </button>
                </Badge>
              ))}
              {!lead.listIds.length && !lead.tags.length ? <span className="text-sm text-slate">None yet.</span> : null}
            </div>
            <form
              className="mt-2.5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                demo.addTag([leadId], tag);
                setTag("");
              }}
            >
              <Label htmlFor={`tag-${leadId}`} className="sr-only">
                Add a tag
              </Label>
              <Input id={`tag-${leadId}`} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add a tag" className="h-9" />
              <Button type="submit" size="sm" variant="secondary" disabled={!tag.trim()} className="h-9">
                Add
              </Button>
            </form>
          </section>
          <section>
            <Label htmlFor={`notes-${leadId}`} className="mb-2 block font-semibold">
              Notes
            </Label>
            <Textarea
              id={`notes-${leadId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== lead.notes && demo.setNotes(leadId, notes)}
              placeholder="Anything worth remembering. Notes are private to your workspace."
              rows={4}
            />
            <FieldHint className="mt-1">{notes === lead.notes ? "Saved." : "Saves when you leave the field."}</FieldHint>
          </section>
        </>
      ) : (
        <Callout tone="info">Save this lead to add notes, tags and lists.</Callout>
      )}
      <p className="flex items-center gap-1.5 text-xs text-slate">
        <ExternalLink aria-hidden className="size-3" /> Sample sources use reserved example domains and do not open.
      </p>
    </div>
  );
}

function CampaignHistory({ leadId, onAdd, saved }: { leadId: string; onAdd: () => void; saved: boolean }) {
  const s = useDemo();
  const campaigns = s.campaigns.filter((c) => c.leadIds.includes(leadId));
  if (!campaigns.length)
    return (
      <EmptyState
        icon={<Megaphone />}
        title="Not in any campaign"
        action={
          <Button size="sm" variant="secondary" onClick={onAdd} disabled={!saved}>
            Add to campaign
          </Button>
        }
      >
        Leads are never enrolled automatically.{!saved ? " Save the lead first." : ""}
      </EmptyState>
    );
  return (
    <ul className="space-y-2">
      {campaigns.map((c) => {
        const e = s.enrollments.find((x) => x.campaignId === c.id && x.leadId === leadId);
        return (
          <li key={c.id} className="rounded-[10px] border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/demo/campaigns" className="text-sm font-medium text-ink hover:text-green">
                {c.name}
              </Link>
              <CampaignStatusBadge status={c.status} />
              {c.isSample ? <SampleBadge /> : null}
            </div>
            <p className="mt-1 text-xs text-slate">
              {e ? `Recipient state: ${e.state}${e.reason ? ` · ${e.reason}` : ""}` : "Not enrolled yet (campaign not launched)."}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
