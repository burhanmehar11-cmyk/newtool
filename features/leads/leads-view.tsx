"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileSearch, ListPlus, MailCheck, Megaphone, Search, Tag, Trash2, Upload, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldError, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Callout, EmptyState } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { EmailStatusBadge, FitBadge, NoEmailBadge } from "@/components/product/badges";
import { demo, getDemoState, useDemo } from "@/demo/store";
import { briefIsStale, contactsOf, getBiz, leadStage } from "@/demo/selectors";
import { setUi, useUi } from "@/demo/ui";
import { toCsv } from "@/demo/csv";
import type { EmailStatus } from "@/lib/domain/types";
import { cn, formatDate } from "@/lib/utils";
import { LeadDrawer } from "./lead-drawer";
import { AddToCampaignDialog } from "./add-to-campaign";

const SAMPLE_CSV = `name,website,email,city,phone
Harbor Point Dental,harbor-point-dental.example,hello@harbor-point-dental.example,Austin,(512) 555-0188
Bluebonnet Family Dentistry,bluebonnet-family-dentistry.example,hello@bluebonnet-family-dentistry.example,Austin,
Quarry Lane Physio,quarry-lane-physio.example,frontdesk@quarry-lane-physio.example,Denver,`;

export function LeadsView() {
  const s = useDemo();
  const ui = useUi();
  const { push } = useToast();
  const [q, setQ] = React.useState("");
  const [list, setList] = React.useState("all");
  const [status, setStatus] = React.useState<"all" | EmailStatus | "none" | "suppressed">("all");
  const [fit, setFit] = React.useState("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [openLead, setOpenLead] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<null | "import" | "list" | "tag" | "campaign" | "remove">(null);

  // Open a lead requested from another screen.
  if (ui.leadId && ui.leadId !== openLead) {
    setOpenLead(ui.leadId);
    setUi({ leadId: null });
  }

  const rows = Object.values(s.leads)
    .map((lead) => {
      const b = getBiz(s, lead.businessId);
      if (!b) return null;
      const c = contactsOf(s, b)[0] ?? null;
      return { lead, b, c, brief: s.briefs[b.id], stage: leadStage(s, b.id) };
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .filter((r) => (list === "all" ? true : r.lead.listIds.includes(list)))
    .filter((r) => {
      if (status === "all") return true;
      if (status === "none") return !r.c;
      if (status === "suppressed") return !!r.c?.suppressed;
      return r.c?.status === status && !r.c.suppressed;
    })
    .filter((r) => (fit === "all" ? true : fit === "none" ? !r.brief : r.brief?.fit.level === fit))
    .filter((r) => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      return [r.b.name, r.b.city, r.b.domain ?? "", r.c?.email ?? "", ...r.lead.tags].some((x) => x.toLowerCase().includes(t));
    })
    .sort((a, b) => b.lead.savedAt.localeCompare(a.lead.savedAt));

  const visibleIds = rows.map((r) => r.b.id);
  const sel = selected.filter((id) => s.leads[id]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => sel.includes(id));
  const total = Object.keys(s.leads).length;

  const exportCsv = () => {
    const st = getDemoState();
    const ids = sel.length ? sel : visibleIds;
    const csv = toCsv(
      ["name", "website", "email", "email_status", "city", "phone", "fit", "stage", "lists", "tags", "collected_at", "source"],
      ids.map((id) => {
        const b = getBiz(st, id)!;
        const c = contactsOf(st, b)[0];
        const lead = st.leads[id];
        return [
          b.name,
          b.domain,
          c?.email ?? "",
          c ? (c.suppressed ? "suppressed" : c.status) : "none",
          b.city,
          b.phone,
          st.briefs[id]?.fit.level ?? "",
          leadStage(st, id),
          lead.listIds.map((l) => st.lists.find((x) => x.id === l)?.name).filter(Boolean).join("; "),
          lead.tags.join("; "),
          b.collectedAt,
          b.provider.name,
        ];
      }),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "locenti-demo-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
    push({ tone: "success", title: `Exported ${ids.length} lead${ids.length === 1 ? "" : "s"}`, body: "The file was created in your browser. Sample data only." });
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Businesses you've saved. Research, verify and draft from here. Nothing is contacted until you add it to a campaign and approve it."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog("import")}>
              <Upload aria-hidden /> Import CSV
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!visibleIds.length}>
              <Download aria-hidden /> Export{sel.length ? ` ${sel.length}` : ""}
            </Button>
          </>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No leads yet"
          action={
            <>
              <Button asChild>
                <Link href="/demo/discover">Find businesses</Link>
              </Button>
              <Button variant="secondary" onClick={() => setDialog("import")}>
                Import a CSV
              </Button>
            </>
          }
        >
          Save businesses from a search, or import a list you already have. Duplicates are detected by website domain.
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Saved lists" className="hidden lg:block">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">Lists</p>
            <ul className="space-y-0.5">
              {[{ id: "all", name: "All leads", count: total }, ...s.lists.map((l) => ({ id: l.id, name: l.name, count: Object.values(s.leads).filter((x) => x.listIds.includes(l.id)).length }))].map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setList(l.id)}
                    aria-current={list === l.id}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-200",
                      list === l.id ? "bg-surface font-medium text-ink shadow-card" : "text-slate hover:text-ink",
                    )}
                  >
                    <span className="truncate">{l.name}</span>
                    <span className="text-xs tabular-nums text-slate">{l.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <div className="relative">
                <Label htmlFor="lead-q" className="sr-only">
                  Search leads
                </Label>
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
                <Input id="lead-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city, email or tag" className="pl-9" />
              </div>
              <div className="lg:hidden">
                <Label htmlFor="lead-list" className="sr-only">
                  List
                </Label>
                <Select id="lead-list" value={list} onChange={(e) => setList(e.target.value)}>
                  <option value="all">All leads</option>
                  {s.lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="lead-status" className="sr-only">
                  Email status
                </Label>
                <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="xl:w-44">
                  <option value="all">Any email status</option>
                  <option value="valid">Valid</option>
                  <option value="unverified">Unverified</option>
                  <option value="catch_all">Catch-all</option>
                  <option value="unknown">Unknown</option>
                  <option value="invalid">Invalid</option>
                  <option value="suppressed">Suppressed</option>
                  <option value="none">No email found</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="lead-fit" className="sr-only">
                  Fit
                </Label>
                <Select id="lead-fit" value={fit} onChange={(e) => setFit(e.target.value)} className="xl:w-40">
                  <option value="all">Any fit</option>
                  <option value="strong">Strong fit</option>
                  <option value="moderate">Moderate fit</option>
                  <option value="weak">Weak fit</option>
                  <option value="none">Not researched</option>
                </Select>
              </div>
            </div>

            {sel.length ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-green/25 bg-mint-soft/50 px-3 py-2">
                <span className="mr-1 text-sm font-medium text-ink">{sel.length} selected</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const st = getDemoState();
                    const ids = sel.flatMap((id) => contactsOf(st, getBiz(st, id)!).filter((c) => c.status === "unverified" && !c.suppressed).map((c) => c.id));
                    if (!ids.length) return push({ tone: "info", title: "Nothing to verify", body: "Selected addresses are already checked, suppressed or missing." });
                    const r = demo.verify(ids);
                    push(r.ok ? { tone: "info", title: `Verifying ${ids.length} address${ids.length === 1 ? "" : "es"}` } : { tone: "error", title: "Couldn't verify", body: r.reason });
                  }}
                >
                  <MailCheck aria-hidden /> Verify
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const todo = sel.filter((id) => !s.briefs[id]);
                    if (!todo.length) return push({ tone: "info", title: "Already researched" });
                    for (const id of todo) {
                      const r = demo.research(id);
                      if (!r.ok) return push({ tone: "error", title: "Couldn't research", body: r.reason });
                    }
                    push({ tone: "info", title: `Researching ${todo.length} lead${todo.length === 1 ? "" : "s"}` });
                  }}
                >
                  <FileSearch aria-hidden /> Research
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("list")}>
                  <ListPlus aria-hidden /> Add to list
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("tag")}>
                  <Tag aria-hidden /> Tag
                </Button>
                <Button size="sm" onClick={() => setDialog("campaign")}>
                  <Megaphone aria-hidden /> Add to campaign
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog("remove")} className="text-danger-fg">
                  <Trash2 aria-hidden /> Remove
                </Button>
              </div>
            ) : null}

            <div className="card overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <caption className="sr-only">Saved leads</caption>
                  <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-2.5">
                        <Checkbox aria-label="Select all visible leads" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? visibleIds : [])} />
                      </th>
                      <th scope="col" className="py-2.5 pr-3 font-medium">Business</th>
                      <th scope="col" className="py-2.5 pr-3 font-medium">Email</th>
                      <th scope="col" className="py-2.5 pr-3 font-medium">Fit</th>
                      <th scope="col" className="py-2.5 pr-3 font-medium">Stage</th>
                      <th scope="col" className="py-2.5 pr-3 font-medium">Tags</th>
                      <th scope="col" className="py-2.5 pr-4 font-medium">Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ lead, b, c, brief, stage }) => {
                      const on = sel.includes(b.id);
                      return (
                        <tr key={b.id} className={cn("border-b border-line transition-colors duration-200 last:border-b-0 hover:bg-canvas/60", on && "bg-mint-soft/30")}>
                          <td className="px-4 py-3">
                            <Checkbox aria-label={`Select ${b.name}`} checked={on} onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== b.id) : [...xs, b.id]))} />
                          </td>
                          <td className="py-3 pr-3">
                            <button type="button" onClick={() => setOpenLead(b.id)} className="text-left font-medium text-ink hover:text-green hover:underline">
                              {b.name}
                            </button>
                            <span className="block text-xs text-slate">
                              {b.city}
                              {b.domain ? ` · ${b.domain}` : ""}
                            </span>
                          </td>
                          <td className="py-3 pr-3">{c ? <EmailStatusBadge status={c.status} verifying={c.verifying} suppressed={c.suppressed} /> : <NoEmailBadge />}</td>
                          <td className="py-3 pr-3">
                            {s.researching.includes(b.id) ? <Badge tone="info">Researching…</Badge> : brief ? <FitBadge level={brief.fit.level} stale={briefIsStale(s, b.id)} /> : <span className="text-xs text-slate">Not researched</span>}
                          </td>
                          <td className="py-3 pr-3 text-[13px] text-ink">{stage}</td>
                          <td className="py-3 pr-3">
                            <div className="flex max-w-[180px] flex-wrap gap-1">
                              {lead.tags.slice(0, 2).map((t) => (
                                <Badge key={t} tone="neutral">
                                  {t}
                                </Badge>
                              ))}
                              {lead.tags.length > 2 ? <Badge tone="outline">+{lead.tags.length - 2}</Badge> : null}
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate">{formatDate(lead.savedAt, { month: "short", day: "numeric" })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!rows.length ? (
                <div className="p-5">
                  <EmptyState title="No leads match these filters">Clear the search or choose another list.</EmptyState>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate">
              {rows.length} of {total} leads shown.
            </p>
          </div>
        </div>
      )}

      <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
      <ImportDialog open={dialog === "import"} onOpenChange={(o) => setDialog(o ? "import" : null)} />
      <ListDialog ids={sel} open={dialog === "list"} onOpenChange={(o) => setDialog(o ? "list" : null)} />
      <TagDialog ids={sel} open={dialog === "tag"} onOpenChange={(o) => setDialog(o ? "tag" : null)} />
      <AddToCampaignDialog leadIds={sel} open={dialog === "campaign"} onOpenChange={(o) => setDialog(o ? "campaign" : null)} onDone={() => setSelected([])} />
      <Dialog open={dialog === "remove"} onOpenChange={(o) => setDialog(o ? "remove" : null)}>
        <DialogContent title={`Remove ${sel.length} lead${sel.length === 1 ? "" : "s"}?`} description="Leads in an active sequence are kept. Suppression entries are never removed by this action.">
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const r = demo.removeLeads(sel);
                setSelected([]);
                setDialog(null);
                push({ tone: "success", title: `Removed ${r.removed}`, body: r.blocked ? `${r.blocked} kept because they're in an active sequence.` : undefined });
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { push } = useToast();
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<ReturnType<typeof demo.importCsv> | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setResult(null);
          setText("");
        }
      }}
    >
      <DialogContent title="Import leads from CSV" description="Columns: name (required), website or email, city, phone. Duplicates are matched by website domain." className="max-w-xl">
        {result ? (
          <div className="space-y-3">
            <Callout tone={result.added ? "green" : "warn"} title={`Imported ${result.added} new lead${result.added === 1 ? "" : "s"}`}>
              <ul className="list-disc pl-4">
                <li>{result.duplicates} duplicate{result.duplicates === 1 ? "" : "s"} skipped</li>
                <li>{result.suppressed} on your suppression list. They stay suppressed after import.</li>
                <li>{result.skipped} row{result.skipped === 1 ? "" : "s"} could not be read</li>
              </ul>
            </Callout>
            {result.errors.length ? (
              <ul className="max-h-32 overflow-y-auto rounded-lg bg-canvas p-3 text-xs text-danger-fg">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-slate">Imported addresses start as Unverified and must be verified before they can be contacted.</p>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">Choose a file</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-canvas file:px-2.5 file:py-1 file:text-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1_000_000) return push({ tone: "error", title: "File too large", body: "The demo accepts files up to 1 MB." });
                  setText(await f.text());
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="csv-text">Or paste CSV</Label>
              <Textarea id="csv-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="font-mono text-xs" placeholder="name,website,email,city" />
              <FieldHint>
                <button type="button" className="font-medium text-green hover:underline" onClick={() => setText(SAMPLE_CSV)}>
                  Use a sample file
                </button>{" "}
                (includes one duplicate of a sample lead).
              </FieldHint>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!text.trim()} onClick={() => setResult(demo.importCsv(text))}>
                Import
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListDialog({ ids, open, onOpenChange }: { ids: string[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useDemo();
  const { push } = useToast();
  const [choice, setChoice] = React.useState("");
  const [name, setName] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Add ${ids.length} to a list`}>
        <div className="space-y-3">
          <Label htmlFor="list-choice">List</Label>
          <Select id="list-choice" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">New list…</option>
            {s.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          {!choice ? (
            <div className="space-y-1.5">
              <Label htmlFor="list-name">New list name</Label>
              <Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          ) : null}
          <FieldError>{err}</FieldError>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                let id = choice;
                if (!id) {
                  if (name.trim().length < 2) return setErr("Name the list.");
                  id = demo.createList(name);
                }
                demo.addToList(ids, id);
                push({ tone: "success", title: "Added to list" });
                setName("");
                setErr(null);
                onOpenChange(false);
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TagDialog({ ids, open, onOpenChange }: { ids: string[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { push } = useToast();
  const [tag, setTag] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Tag ${ids.length} lead${ids.length === 1 ? "" : "s"}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!tag.trim()) return;
            demo.addTag(ids, tag);
            push({ tone: "success", title: `Tagged “${tag.trim().toLowerCase()}”` });
            setTag("");
            onOpenChange(false);
          }}
        >
          <Label htmlFor="bulk-tag">Tag</Label>
          <Input id="bulk-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. call first" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!tag.trim()}>
              Add tag
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
