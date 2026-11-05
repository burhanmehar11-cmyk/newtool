"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { discoveryNiches } from "@/lib/discovery/niches";
import { countries } from "@/lib/geo/regions";

const field = "h-12 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:border-mint/60 focus-visible:outline-none";

/** Opens Discover with the fields filled in and a one-time run id, so the search runs once. */
export function QuickSearchForm() {
  const router = useRouter();
  const all = React.useMemo(() => countries(), []);
  return (
    <form
      className="mt-6 grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const type = String(fd.get("type") ?? "").trim();
        const place = String(fd.get("place") ?? "").trim();
        if (type.length < 2 || place.length < 2) return;
        const q = new URLSearchParams({ type, place, country: String(fd.get("country") ?? "US"), run: Date.now().toString(36) });
        router.push(`/app/discover?${q}`);
      }}
    >
      <label className="sr-only" htmlFor="qs-type">Business type</label>
      <input id="qs-type" name="type" list="qs-type-list" required minLength={2} placeholder="Business type, e.g. dentists" autoComplete="off" className={field} />
      <datalist id="qs-type-list">
        {discoveryNiches.map((n) => (
          <option key={n.id} value={n.label} />
        ))}
      </datalist>
      <label className="sr-only" htmlFor="qs-place">City or area</label>
      <input id="qs-place" name="place" required minLength={2} placeholder="City or area, e.g. Austin" autoComplete="off" className={field} />
      <label className="sr-only" htmlFor="qs-country">Country</label>
      <select id="qs-country" name="country" defaultValue="US" className={`${field} px-3 [&>option]:text-ink`}>
        {all.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-mint px-6 text-[15px] font-semibold text-midnight transition-colors hover:bg-mint-strong">
        <Search aria-hidden className="size-4" /> Search
      </button>
    </form>
  );
}
