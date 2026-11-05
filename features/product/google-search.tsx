"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, MapPinned, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldError, FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Callout, EmptyState } from "@/components/ui/misc";
import { discoveryNiches } from "@/lib/discovery/niches";
import { googleMapsLink } from "@/lib/discovery/google-places";
import { googleDetailsAction, runGoogleSearchAction, saveGoogleLeadsAction } from "@/server/actions/discovery";
import type { GoogleResult, GoogleSearchOutcome } from "@/server/services/discovery";
import { cn } from "@/lib/utils";

type Done = Extract<GoogleSearchOutcome, { ok: true }> & { niche: string };

/** Google's attribution for Places content shown without a Google map. */
export function GoogleCredit() {
  return (
    <p className="text-xs text-slate">
      Results from{" "}
      <span translate="no" className="font-medium text-[#5e5e5e]">
        Google Maps
      </span>
      . Shown live and not stored by Locentio; saving a lead keeps only its Google place ID and website.
    </p>
  );
}

export function GoogleSearchForm({ available, remainingToday, onResult }: { available: number; remainingToday: number | null; onResult: (r: Done | null) => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [maxResults, setMaxResults] = React.useState(20);
  const requests = maxResults / 20;
  const over = maxResults > available;
  const noCalls = remainingToday !== null && remainingToday < 1;

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const values = Object.fromEntries(fd);
        setError(null);
        setFieldErrors({});
        start(async () => {
          const r = await runGoogleSearchAction(values);
          if (r.ok) onResult({ ...r, niche: String(values.niche) });
          else {
            setError(r.error);
            setFieldErrors(r.fieldErrors ?? {});
            onResult(null);
          }
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="g-niche">Business type</Label>
          <Select id="g-niche" name="niche" defaultValue="dental">
            {discoveryNiches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-place">City or area</Label>
          <Input id="g-place" name="place" placeholder="e.g. Austin, TX" autoComplete="off" aria-invalid={!!fieldErrors.place} required />
          {fieldErrors.place ? <FieldError>{fieldErrors.place}</FieldError> : <FieldHint>Searched like you would on Google Maps: “dentists in Austin, TX”.</FieldHint>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-rating">Google rating</Label>
          <Select id="g-rating" name="minRating" defaultValue="0">
            <option value="0">Any rating</option>
            <option value="3.5">3.5 and up</option>
            <option value="4">4.0 and up</option>
            <option value="4.5">4.5 and up</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-website">Website</Label>
          <Select id="g-website" name="website" defaultValue="has">
            <option value="has">Has a website (needed for research)</option>
            <option value="any">Any</option>
            <option value="none">No website listed</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-max">Maximum results</Label>
          <Select id="g-max" name="maxResults" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>
            {[20, 40, 60].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <FieldHint>
            Uses up to {maxResults} discovery units (you have {available}) and {requests} Google request{requests === 1 ? "" : "s"}
            {remainingToday !== null ? ` (${remainingToday} left today)` : ""}.
          </FieldHint>
        </div>
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Button type="submit" disabled={pending || over || noCalls}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <MapPinned aria-hidden />}
        {pending ? "Searching Google Maps…" : "Search Google Maps"}
      </Button>
      {over ? <p className="text-xs text-danger-fg">Lower the maximum results to fit your remaining units.</p> : null}
      {noCalls ? <p className="text-xs text-danger-fg">Today&apos;s Google Maps limit is used up. It resets at midnight UTC; OpenStreetMap search still works.</p> : null}
    </form>
  );
}

export function GoogleResults({ result }: { result: Done }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<GoogleResult[]>(result.results);
  const selectable = rows.filter((r) => !r.saved && r.website).map((r) => r.placeId);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, start] = React.useTransition();
  const [status, setStatus] = React.useState<{ tone: "green" | "danger"; text: string } | null>(null);

  if (!rows.length)
    return (
      <div className="p-5">
        <EmptyState icon={<MapPinned />} title="No businesses found">
          Google Maps returned no matches{result.filteredOut ? ` after your filters (${result.filteredOut} hidden)` : ""}. Try a nearby city or loosen the filters.
        </EmptyState>
      </div>
    );

  return (
    <div>
      {selected.length || status ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-mint-soft/40 px-5 py-2.5">
          {selected.length ? (
            <>
              <span className="text-sm font-medium text-ink">{selected.length} selected</span>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const items = rows.filter((r) => selected.includes(r.placeId) && r.website).map((r) => ({ placeId: r.placeId, website: r.website! }));
                    const r = await saveGoogleLeadsAction({ niche: result.niche, items });
                    if (r.ok) {
                      setRows((xs) => xs.map((x) => (selected.includes(x.placeId) ? { ...x, saved: true } : x)));
                      setStatus({ tone: "green", text: `Saved ${r.added} lead${r.added === 1 ? "" : "s"}.` });
                      setSelected([]);
                      router.refresh();
                    } else setStatus({ tone: "danger", text: r.error });
                  })
                }
              >
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : null} Save to leads
              </Button>
            </>
          ) : null}
          {status ? (
            <Callout tone={status.tone} className="py-1.5">
              <span role="status">
                {status.text} {status.tone === "green" ? <Link href="/app/leads">Open leads to research them</Link> : null}
              </span>
            </Callout>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Google Maps results</caption>
          <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
            <tr>
              <th scope="col" className="w-10 px-5 py-2.5">
                <Checkbox
                  aria-label="Select all results with a website"
                  checked={selectable.length > 0 && selected.length === selectable.length}
                  disabled={!selectable.length}
                  onChange={(e) => setSelected(e.target.checked ? selectable : [])}
                />
              </th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Business</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Rating</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Website</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Phone</th>
              <th scope="col" className="py-2.5 pr-5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = selected.includes(r.placeId);
              return (
                <tr key={r.placeId} className={cn("border-b border-line last:border-b-0", on && "bg-mint-soft/30")}>
                  <td className="px-5 py-3">
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={on}
                      disabled={r.saved || !r.website}
                      onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== r.placeId) : [...xs, r.placeId]))}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <a href={googleMapsLink(r.placeId, r.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:text-green hover:underline">
                      {r.name} <ExternalLink aria-hidden className="size-3 text-slate" />
                    </a>
                    <span className="block text-xs text-slate">
                      {[r.category, r.address].filter(Boolean).join(" · ") || "Address not listed"}
                      {r.status === "CLOSED_TEMPORARILY" ? " · Temporarily closed" : ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-ink">
                    {r.rating !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star aria-hidden className="size-3.5 fill-current text-[#d99a00]" />
                        {r.rating.toFixed(1)}
                        <span className="text-slate">({r.ratingCount ?? 0})</span>
                      </span>
                    ) : (
                      <span className="text-slate">No rating</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate py-3 pr-3 font-mono text-xs text-slate">
                    {r.website ? (
                      <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-green hover:underline">
                        {r.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    ) : (
                      "Not listed"
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate">{r.phone ?? "Not listed"}</td>
                  <td className="py-3 pr-5 text-right">
                    {r.saved ? <Badge tone="green">In leads</Badge> : r.website ? <Badge tone="outline">New</Badge> : <Badge tone="neutral">No website</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Details = { name: string; address: string | null; phone: string | null; website: string | null; rating: number | null; ratingCount: number | null; category: string | null; status: string | null; hours: string[] };

/** Live Google Maps details for a saved lead: fetched on request, shown, never stored. */
export function GoogleDetails({ placeId, label }: { placeId: string; label: string }) {
  const [pending, start] = React.useTransition();
  const [state, setState] = React.useState<{ details?: Details; error?: string }>({});
  const d = state.details;
  return (
    <div className="space-y-3 text-sm">
      {d ? (
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          <dt className="text-slate">Name</dt>
          <dd className="font-medium text-ink">{d.name}</dd>
          <dt className="text-slate">Category</dt>
          <dd className="text-ink">{d.category ?? "Unknown"}</dd>
          <dt className="text-slate">Address</dt>
          <dd className="text-ink">{d.address ?? "Not listed"}</dd>
          <dt className="text-slate">Phone</dt>
          <dd className="text-ink">{d.phone ?? "Not listed"}</dd>
          <dt className="text-slate">Rating</dt>
          <dd className="text-ink">{d.rating !== null ? `${d.rating.toFixed(1)} from ${d.ratingCount ?? 0} reviews` : "No rating"}</dd>
          {d.status && d.status !== "OPERATIONAL" ? (
            <>
              <dt className="text-slate">Status</dt>
              <dd className="text-ink">{d.status === "CLOSED_TEMPORARILY" ? "Temporarily closed" : "Permanently closed"}</dd>
            </>
          ) : null}
          {d.hours.length ? (
            <>
              <dt className="text-slate">Hours</dt>
              <dd className="text-xs leading-5 text-ink">
                {d.hours.map((h) => (
                  <span key={h} className="block">
                    {h}
                  </span>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-slate">Google&apos;s listing details (address, phone, rating, hours) are fetched live when you ask, because Google doesn&apos;t allow storing them. Each look-up uses one of today&apos;s Google requests.</p>
      )}
      {state.error ? <Callout tone="danger">{state.error}</Callout> : null}
      <div className="flex flex-wrap items-center gap-2">
        {!d ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await googleDetailsAction(placeId); setState(r.ok ? { details: r.details } : { error: r.error }); })}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <MapPinned aria-hidden />} Show Google Maps details
          </Button>
        ) : null}
        <a href={googleMapsLink(placeId, d?.name ?? label)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-green hover:underline">
          Open in Google Maps <ExternalLink aria-hidden className="size-3" />
        </a>
      </div>
      {d ? <GoogleCredit /> : null}
    </div>
  );
}
