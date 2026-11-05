"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { discoveryNiches } from "@/lib/discovery/niches";

/** Opens Discover with the fields filled in and a one-time run id, so the search runs once. */
export function QuickSearchForm() {
  const router = useRouter();
  return (
    <form
      className="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const place = String(fd.get("place") ?? "").trim();
        if (place.length < 2) return;
        const q = new URLSearchParams({ niche: String(fd.get("niche") ?? "dental"), place, run: Date.now().toString(36) });
        router.push(`/app/discover?${q}`);
      }}
    >
      <label className="sr-only" htmlFor="qs-niche">Business type</label>
      <select id="qs-niche" name="niche" defaultValue="dental" className="h-12 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[15px] text-white focus-visible:border-mint/60 focus-visible:outline-none [&>option]:text-ink">
        {discoveryNiches.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="qs-place">City or area</label>
      <input id="qs-place" name="place" required minLength={2} placeholder="City or area, e.g. Austin, TX" className="h-12 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:border-mint/60 focus-visible:outline-none" />
      <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-mint px-6 text-[15px] font-semibold text-midnight transition-colors hover:bg-mint-strong">
        <Search aria-hidden className="size-4" /> Search
      </button>
    </form>
  );
}
