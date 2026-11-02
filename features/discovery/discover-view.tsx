"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CircleCheck, Loader2, Play, Search, Sparkles, Square, Star, Wand2, XCircle } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Callout, EmptyState, Progress, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { EmailStatusBadge, NoEmailBadge, SampleBadge } from "@/components/product/badges";
import { demo, useDemo } from "@/demo/store";
import { contactsOf, getBiz, usageSummary } from "@/demo/selectors";
import { cities, niches } from "@/demo/fixtures/catalog";
import { DEFAULT_FILTERS, parseQuery } from "@/demo/parse";
import { canSearch, estimateMaxUnits } from "@/demo/search";
import { usageUnitDefinitions } from "@/config/plans";
import type { DiscoveryFilters, NicheId } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { LeadDrawer } from "@/features/leads/lead-drawer";

const EXAMPLES = [
  "Dental clinics in Austin with a website and 30+ reviews",
  "HVAC contractors in Denver rated 4.5+",
  "Med spas in Raleigh without a website",
  "Physical therapy clinics in Columbus within 10 miles",
];

export function DiscoverView() {
  const s = useDemo();
  const { push } = useToast();
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [parsed, setParsed] = React.useState<ReturnType<typeof parseQuery> | null>(null);
  const [failNext, setFailNext] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [openLead, setOpenLead] = React.useState<string | null>(null);
  const [listChoice, setListChoice] = React.useState("");
  const [newList, setNewList] = React.useState("");
  const [runError, setRunError] = React.useState<string | null>(null);
  const prefilled = React.useRef(false);

  const applyParse = React.useCallback((q: string) => {
    const p = parseQuery(q);
    setParsed(p);
    setFilters(p.filters);
    setRunError(null);
  }, []);

  // Prefill from the landing-page search (?q=…). Parsed only; never run automatically.
  React.useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      const t = window.setTimeout(() => {
        setQuery(q.slice(0, 200));
        applyParse(q.slice(0, 200));
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [applyParse]);

  const job = s.job;
  const usage = usageSummary(s).discovery;
  const estimate = estimateMaxUnits(filters);
  const valid = canSearch(filters);
  const running = job?.status === "running";
  const overBudget = estimate > usage.available;
  const results = (job?.resultIds ?? []).map((id) => getBiz(s, id)!).filter(Boolean);
  const pendingPages = job ? job.pages.filter((p) => p.status === "pending").length : 0;
  const donePages = job ? job.pages.filter((p) => p.status === "done").length : 0;

  const set = <K extends keyof DiscoveryFilters>(k: K, v: DiscoveryFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const runSearch = () => {
    setRunError(null);
    setSelected([]);
    const r = demo.startSearch(query, filters, { failNextPage: failNext });
    if (!r.ok) setRunError(r.reason ?? "Search could not start.");
  };

  const saveSelected = () => {
    let listId = listChoice || undefined;
    if (listChoice === "__new") {
      if (!newList.trim()) return;
      listId = demo.createList(newList);
      setListChoice(listId);
      setNewList("");
    }
    const r = demo.saveLeads(selected, listId);
    push({
      tone: "success",
      title: `Saved ${r.added} lead${r.added === 1 ? "" : "s"}`,
      body: r.duplicates ? `${r.duplicates} already in Leads were not duplicated.` : undefined,
    });
    setSelected([]);
  };

  return (
    <div>
      <PageHeader
        title="Discover"
        description="Describe who you want to reach. Review the filters, check the estimated usage, then run the search."
        actions={<SampleBadge label="Sample data: 5 cities, 8 niches" />}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <SectionCard title="1. Describe your search" bodyClassName="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyParse(query);
            }}
            className="space-y-2"
          >
            <Label htmlFor="nl-query">In plain words</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
                <Input
                  id="nl-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. Dental clinics in Austin with a website and 30+ reviews"
                  className="pl-9"
                  maxLength={200}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={!query.trim()}>
                <Wand2 aria-hidden /> Read filters
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQuery(ex);
                    applyParse(ex);
                  }}
                  className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-slate transition-colors duration-200 hover:border-line-strong hover:text-ink"
                >
                  {ex}
                </button>
              ))}
            </div>
          </form>

          {parsed && (parsed.unrecognized.length || parsed.unsupportedCity || !parsed.filters.niche) ? (
            <Callout tone="warn" icon={<AlertTriangle />} title="Check these filters">
              <ul className="list-disc pl-4">
                {!parsed.filters.niche ? <li>No business type recognised. Choose one below.</li> : null}
                {parsed.unsupportedCity ? <li>“{parsed.unsupportedCity}” has no sample data. Choose one of the sample cities.</li> : null}
                {parsed.unrecognized.length ? <li>Not understood: {parsed.unrecognized.join(", ")}. These words were ignored.</li> : null}
              </ul>
            </Callout>
          ) : parsed ? (
            <Callout tone="green" icon={<CircleCheck />}>
              Filters read from your request. Edit anything before running.
            </Callout>
          ) : null}

          <fieldset>
            <legend className="mb-3 text-[13px] font-semibold text-ink">2. Review filters</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-niche">Business type</Label>
                <Select id="f-niche" value={filters.niche ?? ""} onChange={(e) => set("niche", (e.target.value || null) as NicheId | null)}>
                  <option value="">Choose…</option>
                  {niches.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-city">City</Label>
                <Select id="f-city" value={filters.city ?? ""} onChange={(e) => set("city", e.target.value || null)}>
                  <option value="">Choose…</option>
                  {cities.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city}, {c.region}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-radius">Radius</Label>
                <Select id="f-radius" value={filters.radiusMi ?? ""} onChange={(e) => set("radiusMi", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Whole city</option>
                  {[5, 10, 15, 25].map((r) => (
                    <option key={r} value={r}>
                      Within {r} mi of centre
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-rating">Minimum rating</Label>
                <Select id="f-rating" value={filters.minRating ?? ""} onChange={(e) => set("minRating", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Any</option>
                  {[3.5, 4, 4.5].map((r) => (
                    <option key={r} value={r}>
                      {r.toFixed(1)} or higher
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-reviews">Minimum reviews</Label>
                <Input
                  id="f-reviews"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5000}
                  value={filters.minReviews ?? ""}
                  onChange={(e) => set("minReviews", e.target.value ? Math.max(0, Number(e.target.value)) : null)}
                  placeholder="Any"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-website">Website</Label>
                <Select id="f-website" value={filters.website} onChange={(e) => set("website", e.target.value as DiscoveryFilters["website"])}>
                  <option value="any">Any</option>
                  <option value="has">Has a website</option>
                  <option value="none">No website</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-max">Maximum results</Label>
                <Input
                  id="f-max"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={100}
                  value={filters.maxResults}
                  onChange={(e) => set("maxResults", Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                />
                <FieldHint>Caps the cost of this search.</FieldHint>
              </div>
            </div>
          </fieldset>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="3. Estimated usage">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate">Up to</dt>
                <dd className="font-semibold tabular-nums text-ink">{estimate} discovery units</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate">Available</dt>
                <dd className={cn("tabular-nums", overBudget ? "font-semibold text-danger-fg" : "text-ink")}>{usage.available} units</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-slate">
              {usageUnitDefinitions.discoveryUnits} The full estimate is reserved while the search runs, and the rest is released when it finishes.
            </p>
            <div className="mt-4 rounded-[10px] border border-dashed border-line-strong/50 p-3">
              <label className="flex items-start gap-2.5 text-[13px] text-ink">
                <Checkbox checked={failNext} onChange={(e) => setFailNext(e.target.checked)} className="mt-0.5" />
                <span>
                  Simulate a provider timeout on page 2
                  <span className="block text-xs text-slate">Demo control: shows partial results and retry.</span>
                </span>
              </label>
            </div>
            {runError ? (
              <p role="alert" className="mt-3 text-[13px] font-medium text-danger-fg">
                {runError}
              </p>
            ) : null}
            <Button className="mt-4 w-full" onClick={runSearch} disabled={!valid.ok || running || overBudget}>
              {running ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
              {running ? "Searching…" : "Run search (simulated)"}
            </Button>
            {!valid.ok ? <p className="mt-2 text-center text-xs text-slate">{valid.reason}</p> : null}
            {overBudget && valid.ok ? <p className="mt-2 text-center text-xs text-danger-fg">Lower the maximum results to fit the allowance.</p> : null}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        className="mt-5"
        title={
          <span className="flex flex-wrap items-center gap-2">
            Results
            {job ? <JobBadge status={job.status} /> : null}
          </span>
        }
        description={job ? `“${job.query || "Filters only"}” · ${results.length} found${job.status === "running" ? " so far" : ""}` : undefined}
        actions={
          running ? (
            <Button size="sm" variant="secondary" onClick={() => demo.cancelSearch()}>
              <Square aria-hidden /> Cancel
            </Button>
          ) : job && job.status !== "partial" ? (
            <Button size="sm" variant="ghost" onClick={() => demo.clearSearch()}>
              Clear
            </Button>
          ) : null
        }
        bodyClassName="p-0"
      >
        {job ? (
          <div className="space-y-3 border-b border-line px-5 py-4">
            {job.totalPages > 0 ? <Progress value={(donePages / job.totalPages) * 100} label="Search progress" /> : null}
            <p className="text-[13px] text-slate" aria-live="polite">
              {job.status === "running"
                ? `Page ${donePages + 1} of ${job.totalPages}. Results appear as each page arrives. ${job.reservedUnits} units reserved.`
                : job.status === "completed"
                  ? `Finished. Charged ${job.chargedUnits} unit${job.chargedUnits === 1 ? "" : "s"}, released ${job.reservedUnits - job.chargedUnits}.`
                  : job.status === "cancelled"
                    ? `Cancelled. Kept ${results.length} results. Charged ${job.chargedUnits}, released ${job.reservedUnits - job.chargedUnits}.`
                    : job.status === "interrupted"
                      ? `${job.error} Charged ${job.chargedUnits}, released ${job.reservedUnits - job.chargedUnits}.`
                      : job.status === "partial" && job.finishedAt
                        ? `Finished with partial results. Charged ${job.chargedUnits}, released ${job.reservedUnits - job.chargedUnits}.`
                        : null}
            </p>
            {job.status === "partial" && !job.finishedAt ? (
              <Callout tone="danger" icon={<XCircle />} title="Part of this search failed">
                {job.error}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => demo.retryFailedPage()}>
                    Retry page
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => demo.finishWithPartial()}>
                    Keep partial results
                  </Button>
                </div>
              </Callout>
            ) : null}
          </div>
        ) : null}

        {!job ? (
          <div className="p-5">
            <EmptyState icon={<Sparkles />} title="No search yet">
              Try an example above. In this demo, searches run against fictional businesses in Austin, Denver, Columbus, Raleigh and Portland.
            </EmptyState>
          </div>
        ) : results.length === 0 && !running ? (
          <div className="p-5">
            <EmptyState icon={<Search />} title="No businesses match">
              Try removing a filter or widening the radius.
            </EmptyState>
          </div>
        ) : (
          <>
            {selected.length ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-mint-soft/40 px-5 py-2.5">
                <span className="text-sm font-medium text-ink">{selected.length} selected</span>
                <Label htmlFor="save-list" className="sr-only">
                  Save to list
                </Label>
                <Select id="save-list" value={listChoice} onChange={(e) => setListChoice(e.target.value)} className="h-8 w-48 text-[13px]">
                  <option value="">No list</option>
                  {s.lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                  <option value="__new">New list…</option>
                </Select>
                {listChoice === "__new" ? (
                  <>
                    <Label htmlFor="new-list-name" className="sr-only">
                      New list name
                    </Label>
                    <Input id="new-list-name" value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="List name" className="h-8 w-44 text-[13px]" />
                  </>
                ) : null}
                <Button size="sm" onClick={saveSelected} disabled={listChoice === "__new" && !newList.trim()}>
                  Save to Leads
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              </div>
            ) : null}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">Search results</caption>
                <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
                  <tr>
                    <th scope="col" className="w-10 px-5 py-2.5">
                      <Checkbox
                        aria-label="Select all results"
                        checked={results.length > 0 && selected.length === results.length}
                        onChange={(e) => setSelected(e.target.checked ? results.map((r) => r.id) : [])}
                      />
                    </th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Business</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Rating</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Website</th>
                    <th scope="col" className="py-2.5 pr-3 font-medium">Email</th>
                    <th scope="col" className="py-2.5 pr-5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((b) => {
                    const on = selected.includes(b.id);
                    const c = contactsOf(s, b)[0];
                    return (
                      <tr key={b.id} className={cn("border-b border-line transition-colors duration-200 last:border-b-0 hover:bg-canvas/60", on && "bg-mint-soft/30")}>
                        <td className="px-5 py-3">
                          <Checkbox
                            aria-label={`Select ${b.name}`}
                            checked={on}
                            onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== b.id) : [...xs, b.id]))}
                          />
                        </td>
                        <td className="py-3 pr-3">
                          <button type="button" onClick={() => setOpenLead(b.id)} className="text-left font-medium text-ink hover:text-green hover:underline">
                            {b.name}
                          </button>
                          <span className="block text-xs text-slate">
                            {b.address} · {b.distanceMi} mi
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-slate">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Star aria-hidden className="size-3 fill-current text-warn-fg" /> {b.rating?.toFixed(1)} · {b.reviewCount}
                          </span>
                        </td>
                        <td className="max-w-[180px] truncate py-3 pr-3 font-mono text-xs text-slate">{b.domain ?? "None listed"}</td>
                        <td className="py-3 pr-3">{c ? <EmailStatusBadge status={c.status} suppressed={c.suppressed} /> : <NoEmailBadge />}</td>
                        <td className="py-3 pr-5 text-right">
                          {s.leads[b.id] ? <Badge tone="green">In Leads</Badge> : <Badge tone="outline">New</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                  {running
                    ? Array.from({ length: Math.min(3, pendingPages * 3) }).map((_, i) => (
                        <tr key={`sk-${i}`} className="border-b border-line">
                          <td className="px-5 py-3">
                            <Skeleton className="size-4" />
                          </td>
                          <td className="py-3 pr-3">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="mt-1.5 h-3 w-64" />
                          </td>
                          <td className="py-3 pr-3">
                            <Skeleton className="h-4 w-16" />
                          </td>
                          <td className="py-3 pr-3">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="py-3 pr-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3 pr-5" />
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
            {results.length ? (
              <p className="border-t border-line px-5 py-3 text-xs text-slate">
                Open a business to see its sources, research it, and draft outreach. Saved leads appear in <Link href="/demo/leads" className="font-medium text-green hover:underline">Leads</Link>.
              </p>
            ) : null}
          </>
        )}
      </SectionCard>

      <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />
    </div>
  );
}

function JobBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "info" | "green" | "warn" | "danger" | "neutral"; label: string }> = {
    running: { tone: "info", label: "Running" },
    completed: { tone: "green", label: "Completed" },
    partial: { tone: "warn", label: "Partial" },
    failed: { tone: "danger", label: "Failed" },
    cancelled: { tone: "neutral", label: "Cancelled" },
    interrupted: { tone: "warn", label: "Interrupted" },
  };
  const m = map[status] ?? map.running;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
