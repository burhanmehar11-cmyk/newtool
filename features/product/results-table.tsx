"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/field";
import { Callout } from "@/components/ui/misc";
import { EmailStatusBadge, NoEmailBadge } from "@/components/product/badges";
import type { EmailStatus } from "@/lib/domain/types";
import type { ResultRow } from "@/server/discovery-store";
import { saveLeadsAction } from "@/server/actions/discovery";
import { cn } from "@/lib/utils";

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const router = useRouter();
  const unsaved = rows.filter((r) => !r.saved).map((r) => r.id);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [pending, start] = React.useTransition();
  const [status, setStatus] = React.useState<{ tone: "green" | "danger"; text: string } | null>(null);

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
                    const r = await saveLeadsAction(selected);
                    if (r.ok) {
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
                {status.text} {status.tone === "green" ? <Link href="/app/leads">View leads</Link> : null}
              </span>
            </Callout>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Search results</caption>
          <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
            <tr>
              <th scope="col" className="w-10 px-5 py-2.5">
                <Checkbox
                  aria-label="Select all unsaved results"
                  checked={unsaved.length > 0 && selected.length === unsaved.length}
                  disabled={!unsaved.length}
                  onChange={(e) => setSelected(e.target.checked ? unsaved : [])}
                />
              </th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Business</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Website</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Public email</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Source</th>
              <th scope="col" className="py-2.5 pr-5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = selected.includes(r.id);
              return (
                <tr key={r.id} className={cn("border-b border-line last:border-b-0", on && "bg-mint-soft/30")}>
                  <td className="px-5 py-3">
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={on}
                      disabled={r.saved}
                      onChange={() => setSelected((xs) => (on ? xs.filter((x) => x !== r.id) : [...xs, r.id]))}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="block text-xs text-slate">{r.address ?? r.city ?? "Address not listed"}</span>
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
                  <td className="py-3 pr-3">
                    {r.email ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs text-ink">{r.email}</span>
                        <EmailStatusBadge status={(r.email_status ?? "unverified") as EmailStatus} />
                      </span>
                    ) : (
                      <NoEmailBadge />
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {r.source_url ? (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green hover:underline">
                        OSM listing <ExternalLink aria-hidden className="size-3" />
                      </a>
                    ) : null}
                  </td>
                  <td className="py-3 pr-5 text-right">{r.saved ? <Badge tone="green">In leads</Badge> : <Badge tone="outline">New</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
