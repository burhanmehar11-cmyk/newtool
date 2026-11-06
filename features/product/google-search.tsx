"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Download, ExternalLink, Globe, Loader2, Mail, MapPinned, Phone, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, FieldError, FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Callout, EmptyState } from "@/components/ui/misc";
import { discoveryNiches } from "@/lib/discovery/niches";
import { countries, STATES } from "@/lib/geo/regions";
import { googleMapsLink } from "@/lib/discovery/google-places";
import { googleDetailsAction, runGoogleSearchAction, saveGoogleLeadsAction } from "@/server/actions/discovery";
import { exportPlacesAction, startCampaignFromPlacesAction } from "@/server/actions/leads-io";
import type { GoogleResult, GoogleSearchOutcome } from "@/server/services/discovery";
import { cn } from "@/lib/utils";

type Done = Extract<GoogleSearchOutcome, { ok: true }> & { niche: string };

/** Google's attribution for Places content shown without a Google map. */
export function GoogleCredit() {
  return (
    <p className="text-xs text-slate">
      Results from{" "}
      <span translate="no" className="font-medium text-[#5e5e5e] dark:text-[#e0e0e0]">
        Google Maps
      </span>
      . Shown live and not stored by Locenti; saving a lead keeps only its Google place ID and website.
    </p>
  );
}

export type SearchPrefill = { niche?: string; place?: string; country?: string; state?: string; runId?: string };

export function GoogleSearchForm({ available, remainingToday, onResult, prefill }: { available: number; remainingToday: number | null; onResult: (r: Done | null) => void; prefill?: SearchPrefill }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const ran = React.useRef(false);
  React.useEffect(() => {
    // Search started from the dashboard: run it once per run id (remembered in this tab, so a reload doesn't spend another Google request).
    const id = prefill?.runId;
    if (!id || !prefill?.place || ran.current) return;
    ran.current = true;
    try {
      if (sessionStorage.getItem("locentio.lastRun") === id) return;
      sessionStorage.setItem("locentio.lastRun", id);
    } catch {
      // storage blocked: still run once for this page view
    }
    formRef.current?.requestSubmit();
  }, [prefill?.runId, prefill?.place]);
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  // As many as Google gives (60), unless the remaining units only cover fewer.
  const [maxResults, setMaxResults] = React.useState(() => [60, 40, 20].find((m) => m <= available) ?? 20);
  const [requireEmail, setRequireEmail] = React.useState(true);
  const [requirePhone, setRequirePhone] = React.useState(false);
  const [requireWebsite, setRequireWebsite] = React.useState(false);
  const [openOnly, setOpenOnly] = React.useState(true);
  const over = maxResults > available;
  const noCalls = remainingToday !== null && remainingToday < 1;

  return (
    <form
      ref={formRef}
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // Unticked checkboxes send nothing: say explicitly which filters are on.
        const values = { ...Object.fromEntries(fd), requireEmail, requirePhone, requireWebsite: requireWebsite || requireEmail, openOnly };
        setError(null);
        setFieldErrors({});
        start(async () => {
          const r = await runGoogleSearchAction(values);
          if (r.ok) onResult({ ...r, niche: r.niche ?? "" });
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="g-type">Business type</Label>
          <Input
            id="g-type"
            name="businessType"
            list="g-type-list"
            defaultValue={prefill?.niche ? (discoveryNiches.find((n) => n.id === prefill.niche)?.label ?? prefill.niche) : ""}
            placeholder="Anything: dentists, wedding photographers, solar installers…"
            autoComplete="off"
            aria-invalid={!!fieldErrors.businessType}
            required
          />
          <datalist id="g-type-list">
            {discoveryNiches.map((n) => (
              <option key={n.id} value={n.label} />
            ))}
          </datalist>
          {fieldErrors.businessType ? <FieldError>{fieldErrors.businessType}</FieldError> : <FieldHint>Type any kind of business, or pick a suggestion.</FieldHint>}
        </div>
        <LocationFields prefillPlace={prefill?.place} prefillCountry={prefill?.country} prefillState={prefill?.state} placeError={fieldErrors.place} />
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium text-ink">Must have</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "requireEmail", label: "Email", icon: Mail, on: requireEmail, set: setRequireEmail },
              { name: "requirePhone", label: "Phone number", icon: Phone, on: requirePhone, set: setRequirePhone },
              { name: "requireWebsite", label: "Website", icon: Globe, on: requireWebsite || requireEmail, set: setRequireWebsite, locked: requireEmail },
            ].map((c) => (
              <label
                key={c.name}
                title={c.locked ? "Emails are found on websites, so this is on while Email is ticked." : undefined}
                className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors", c.on ? "border-green bg-mint-soft text-ink" : "border-line text-slate hover:text-ink", c.locked && "cursor-default opacity-80")}
              >
                <Checkbox name={c.name} checked={c.on} disabled={c.locked} onChange={(e) => c.set(e.target.checked)} className="sr-only" />
                <c.icon aria-hidden className={cn("size-4", c.on ? "text-green" : "text-slate")} /> {c.label}
              </label>
            ))}
          </div>
          <FieldHint>Only businesses with everything ticked are shown, and only those use units.</FieldHint>
        </fieldset>
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
          <Label htmlFor="g-reviews">Number of reviews</Label>
          <Select id="g-reviews" name="minReviews" defaultValue="0">
            <option value="0">Any</option>
            <option value="10">10 or more</option>
            <option value="50">50 or more</option>
            <option value="100">100 or more</option>
          </Select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <Checkbox name="openOnly" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open businesses only (leave out temporarily closed)
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="g-max">How many</Label>
          <Select id="g-max" name="maxResults" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>
            {[20, 40, 60].map((m) => (
              <option key={m} value={m}>
                Up to {m}
              </option>
            ))}
          </Select>
          <FieldHint>
            Uses one unit per business returned (you have {available}). Locenti checks up to 60 Google Maps results to find matches
            {remainingToday !== null ? ` (${remainingToday} Google requests left today)` : ""}.
          </FieldHint>
        </div>
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Button type="submit" disabled={pending || over || noCalls}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <MapPinned aria-hidden />}
        {pending ? "Searching and finding emails… (up to a minute)" : "Search Google Maps"}
      </Button>
      {over ? <p className="text-xs text-danger-fg">Lower the maximum results to fit your remaining units.</p> : null}
      {noCalls ? <p className="text-xs text-danger-fg">Today&apos;s Google Maps limit is used up. It resets at midnight UTC; OpenStreetMap search still works.</p> : null}
    </form>
  );
}

/** Downloads text as a file in the browser. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GoogleResults({ result }: { result: Done }) {
  const router = useRouter();
  const leftOut = [
    result.noEmail ? `${result.noEmail} without an email${result.withoutEmail?.length ? " (listed below)" : ""}` : "",
    result.noWebsite ? `${result.noWebsite} without a website` : "",
    result.noPhone ? `${result.noPhone} without a phone` : "",
    result.fewReviews ? `${result.fewReviews} with too few reviews` : "",
    result.closed ? `${result.closed} temporarily closed` : "",
  ]
    .filter(Boolean)
    .join(", ");
  // Matches first, then businesses whose website showed no email we could find (listed so nothing silently disappears; not charged, not preselected).
  const [rows, setRows] = React.useState<GoogleResult[]>(() => [...result.results, ...(result.withoutEmail ?? [])]);
  const matches = result.results.length;
  // Saving needs a website (research reads it), so rows without one can't be selected.
  const selectable = rows.filter((r) => r.website).map((r) => r.placeId);
  const [selected, setSelected] = React.useState<string[]>(() => result.results.filter((r) => !r.saved && r.website).map((r) => r.placeId));
  const [pending, start] = React.useTransition();
  const [busy, setBusy] = React.useState<null | "save" | "csv" | "campaign">(null);
  const [status, setStatus] = React.useState<{ tone: "green" | "danger" | "info"; text: string; href?: string; link?: string } | null>(null);

  if (!matches && !rows.length)
    return (
      <div className="p-5">
        <EmptyState icon={<MapPinned />} title="No businesses with a public email here">
          We checked {result.scanned} businesses on Google Maps and none matched your filters{leftOut ? ` (${leftOut})` : ""}. Nothing was charged. Try loosening a filter, a nearby city or another business type.
        </EmptyState>
      </div>
    );

  /** Saves the selected rows that aren't in Leads yet (with their emails), then returns all selected place ids. */
  const saveSelected = async (): Promise<string[] | null> => {
    const toSave = rows.filter((r) => selected.includes(r.placeId) && !r.saved && r.website);
    if (toSave.length) {
      const r = await saveGoogleLeadsAction({ niche: result.niche, items: toSave.map((x) => ({ placeId: x.placeId, website: x.website!, siteName: x.siteName, emails: x.emails })) });
      if (!r.ok) {
        setStatus({ tone: "danger", text: r.error });
        return null;
      }
      setRows((xs) => xs.map((x) => (selected.includes(x.placeId) ? { ...x, saved: true } : x)));
    }
    return selected;
  };
  const run = (kind: "save" | "csv" | "campaign", fn: () => Promise<void>) =>
    start(async () => {
      setBusy(kind);
      setStatus(null);
      try {
        await fn();
      } finally {
        setBusy(null);
        router.refresh();
      }
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-sm text-slate">
        <Mail aria-hidden className="size-3.5 text-green" />
        <span>
          <span className="font-medium tabular-nums text-ink">{matches}</span> matching business{matches === 1 ? "" : "es"}
          <span className="text-xs"> · checked {result.scanned} on Google Maps{leftOut ? `; left out and not charged: ${leftOut}` : ""}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-mint-soft/40 px-5 py-2.5">
        <span className="mr-1 text-sm font-medium text-ink">{selected.length} selected</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !selected.length}
          onClick={() =>
            run("save", async () => {
              const ids = await saveSelected();
              if (ids) setStatus({ tone: "green", text: `${ids.length} in Leads.`, href: "/app/leads", link: "Open Leads" });
            })
          }
        >
          {busy === "save" ? <Loader2 aria-hidden className="animate-spin" /> : <BookmarkPlus aria-hidden />} Save to leads
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !selected.length}
          onClick={() =>
            run("csv", async () => {
              const ids = await saveSelected();
              if (!ids) return;
              const r = await exportPlacesAction(ids);
              if (r.ok) {
                download(r.filename, r.csv);
                setStatus({ tone: "green", text: `Saved to Leads and downloaded ${r.count} as CSV.` });
              } else setStatus({ tone: "danger", text: r.error });
            })
          }
        >
          {busy === "csv" ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />} Save &amp; download CSV
        </Button>
        <Button
          size="sm"
          disabled={pending || !selected.length}
          onClick={() =>
            run("campaign", async () => {
              const ids = await saveSelected();
              if (!ids) return;
              setStatus({ tone: "info", text: `Reading ${ids.length} website${ids.length === 1 ? "" : "s"} and writing a first email for each…` });
              const r = await startCampaignFromPlacesAction({ name: `${result.query}`.slice(0, 120), placeIds: ids });
              if (r.ok) router.push(`/app/campaigns/${r.id}`);
              else setStatus({ tone: "danger", text: r.error });
            })
          }
        >
          {busy === "campaign" ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} Start campaign
        </Button>
        {status ? (
          <Callout tone={status.tone} className="py-1.5">
            <span role="status">
              {status.text} {status.href ? <Link href={status.href}>{status.link}</Link> : null}
            </span>
          </Callout>
        ) : null}
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <caption className="sr-only">Google Maps results</caption>
          <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
            <tr>
              <th scope="col" className="w-10 px-5 py-2.5">
                <Checkbox aria-label="Select all results" checked={selectable.length > 0 && selected.length === selectable.length} onChange={(e) => setSelected(e.target.checked ? selectable : [])} />
              </th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Business</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Rating</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Website</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Email</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Phone</th>
              <th scope="col" className="py-2.5 pr-5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const on = selected.includes(r.placeId);
              return (
                <React.Fragment key={r.placeId}>
                {i === matches ? (
                  <tr className="border-b border-line bg-canvas/60">
                    <td colSpan={7} className="px-5 py-2.5 text-xs text-slate">
                      <span className="font-medium text-ink">{rows.length - matches} {matches ? "more" : rows.length - matches === 1 ? "business" : "businesses"} with a website, but no email we could find on it.</span> Not charged. Open their site or call them, or save them to try research later.
                    </td>
                  </tr>
                ) : null}
                <tr className={cn("border-b border-line last:border-b-0", on && "bg-mint-soft/30")}>
                  <td className="px-5 py-3">
                    <Checkbox aria-label={`Select ${r.name}`} checked={on} disabled={!r.website} title={r.website ? undefined : "No website, so it can't be saved or researched"} onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== r.placeId) : [...xs, r.placeId]))} />
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
                  <td className="max-w-[230px] py-3 pr-3 text-xs">
                    <EmailCell r={r} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate">{r.phone ?? "Not listed"}</td>
                  <td className="py-3 pr-5 text-right">{r.saved ? <Badge tone="green">In leads</Badge> : <Badge tone="outline">New</Badge>}</td>
                </tr>
                </React.Fragment>
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

function EmailCell({ r }: { r: GoogleResult }) {
  const first = r.emails[0];
  if (!first) return <span className="text-slate">None found</span>;
  return (
    <span className="block">
      <a href={first.url} target="_blank" rel="noopener noreferrer nofollow" title={`Shown on ${first.url}`} className="block truncate font-mono text-ink hover:text-green hover:underline">
        {first.email}
      </a>
      {r.emails.length > 1 ? <span className="text-[11px] text-slate">+{r.emails.length - 1} more</span> : null}
    </span>
  );
}

/** Country, then state/province (suggestions for common countries), then city or area. */
export function LocationFields({ prefillPlace, prefillCountry, prefillState, placeError, idPrefix = "g" }: { prefillPlace?: string; prefillCountry?: string; prefillState?: string; placeError?: string; idPrefix?: string }) {
  const all = React.useMemo(() => countries(), []);
  const [country, setCountry] = React.useState((prefillCountry ?? "US").toUpperCase());
  const states = STATES[country] ?? [];
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-country`}>Country</Label>
        <Select id={`${idPrefix}-country`} name="country" value={country} onChange={(e) => setCountry(e.target.value)}>
          {all.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-state`}>
          State or province <span className="font-normal text-slate">(optional)</span>
        </Label>
        <Input id={`${idPrefix}-state`} name="state" list={states.length ? `${idPrefix}-state-list` : undefined} defaultValue={prefillState} placeholder={states[0] ? `e.g. ${states[0]}` : "e.g. the region"} autoComplete="off" maxLength={60} />
        {states.length ? (
          <datalist id={`${idPrefix}-state-list`}>
            {states.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        ) : null}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-place`}>City or area</Label>
        <Input id={`${idPrefix}-place`} name="place" defaultValue={prefillPlace} placeholder="e.g. Austin, or a neighbourhood like Brooklyn" autoComplete="off" aria-invalid={!!placeError} required />
        {placeError ? <FieldError>{placeError}</FieldError> : <FieldHint>Searched like on Google Maps: “dentists in Austin, Texas, United States”.</FieldHint>}
      </div>
    </>
  );
}
