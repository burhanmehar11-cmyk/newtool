"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { discoveryNiches } from "@/lib/discovery/niches";
import { runSearchAction } from "@/server/actions/discovery";

export function DiscoverForm({ available }: { available: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [maxResults, setMaxResults] = React.useState(25);
  const over = maxResults > available;

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setFieldErrors({});
        start(async () => {
          const r = await runSearchAction(Object.fromEntries(fd));
          if (r.ok) router.push(`/app/discover?job=${r.jobId}`);
          else {
            setError(r.error);
            setFieldErrors(r.fieldErrors ?? {});
            if (r.jobId) router.push(`/app/discover?job=${r.jobId}`);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="d-niche">Business type</Label>
          <Select id="d-niche" name="niche" defaultValue="dental">
            {discoveryNiches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-place">City or area</Label>
          <Input id="d-place" name="place" placeholder="e.g. Austin, TX" autoComplete="off" aria-invalid={!!fieldErrors.place} required />
          {fieldErrors.place ? <FieldError>{fieldErrors.place}</FieldError> : <FieldHint>Worldwide. Add the region for common names.</FieldHint>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-radius">Radius</Label>
          <Select id="d-radius" name="radiusKm" defaultValue="5">
            {[2, 5, 10, 25].map((r) => (
              <option key={r} value={r}>
                Within {r} km (~{Math.round(r * 0.621)} mi)
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-website">Website</Label>
          <Select id="d-website" name="website" defaultValue="any">
            <option value="any">Any</option>
            <option value="has">Has a website listed</option>
            <option value="none">No website listed</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-max">Maximum results</Label>
          <Select id="d-max" name="maxResults" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>
            {[10, 25, 50].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <FieldHint>
            Uses up to {maxResults} discovery units; you have {available} left. You&apos;re charged only for businesses returned.
          </FieldHint>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-rating">Rating and reviews</Label>
          <Select id="d-rating" disabled defaultValue="na" aria-describedby="d-rating-note">
            <option value="na">Not available from this source</option>
          </Select>
          <FieldHint id="d-rating-note">OpenStreetMap doesn&apos;t include ratings or review counts, so these filters are off rather than guessed.</FieldHint>
        </div>
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <Button type="submit" disabled={pending || over}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Search aria-hidden />}
        {pending ? "Searching OpenStreetMap…" : "Search"}
      </Button>
      {over ? <p className="text-xs text-danger-fg">Lower the maximum results to fit your remaining units.</p> : null}
    </form>
  );
}
