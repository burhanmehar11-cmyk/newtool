import type * as React from "react";
import { cn } from "@/lib/utils";

/** Small building blocks shared by the admin tabs. */

export function Tiles({ items }: { items: { label: string; value: string; hint?: string; tone?: "warn" | "green" }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((t) => (
        <div key={t.label} className="card min-w-0 p-4">
          <dt className="truncate text-xs font-medium text-slate">{t.label}</dt>
          <dd className={cn("mt-1 truncate font-display text-2xl font-semibold tabular-nums", t.tone === "warn" ? "text-warn-fg" : t.tone === "green" ? "text-green" : "text-ink")}>{t.value}</dd>
          {t.hint ? <dd className="mt-0.5 truncate text-xs text-slate">{t.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export function Panel({ title, description, actions, children, flush }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className="card min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-slate">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Table({ head, children, minWidth = 720, caption }: { head: (string | { label: string; right?: boolean })[]; children: React.ReactNode; minWidth?: number; caption: string }) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
          <tr>
            {head.map((h, i) => {
              const label = typeof h === "string" ? h : h.label;
              const right = typeof h !== "string" && h.right;
              return (
                <th key={label} scope="col" className={cn("py-2.5 pr-3 font-medium", i === 0 && "pl-5", right && "text-right")}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-line [&_tr:last-child]:border-b-0 [&_td]:py-2.5 [&_td]:pr-3 [&_td:first-child]:pl-5">{children}</tbody>
      </table>
    </div>
  );
}

export const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");
export const num = (v: number) => v.toLocaleString("en-US");
export const delta = (now: number, before: number) => (before > 0 ? `${now >= before ? "+" : ""}${Math.round(((now - before) / before) * 100)}% vs previous 30 days` : now ? "none in the previous 30 days" : undefined);
