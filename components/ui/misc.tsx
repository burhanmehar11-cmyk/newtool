import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-ink/[0.07]", className)} {...props} />;
}

export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]", className)}
    >
      <div className="h-full rounded-full bg-green transition-[width] duration-300 ease-out" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Meter({
  used,
  total,
  label,
  className,
  dark,
}: {
  used: number;
  total: number;
  label: string;
  className?: string;
  dark?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className={className}>
      <div className={cn("mb-1.5 flex items-baseline justify-between text-xs", dark ? "text-fog" : "text-slate")}>
        <span>{label}</span>
        <span className={cn("tabular-nums", dark ? "text-white" : "text-ink")}>
          {used.toLocaleString("en-US")} / {total.toLocaleString("en-US")}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={used}
        className={cn("h-1.5 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-ink/[0.08]")}
      >
        <div
          className={cn("h-full rounded-full", pct > 90 ? "bg-danger-fg" : dark ? "bg-mint" : "bg-green")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong/50 bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {children ? <div className="mt-1.5 max-w-sm text-sm leading-6 text-slate">{children}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Callout({
  tone = "info",
  icon,
  title,
  children,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "green" | "demo";
  icon?: React.ReactNode;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-info-bg text-info-fg",
    warn: "bg-warn-bg text-warn-fg",
    danger: "bg-danger-bg text-danger-fg",
    green: "bg-mint-soft text-green",
    demo: "bg-demo-bg text-demo-fg",
  } as const;
  return (
    <div className={cn("flex gap-3 rounded-xl px-3.5 py-3 text-sm leading-6", tones[tone], className)}>
      {icon ? <div className="mt-[3px] shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "[&_a]:underline")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-sans text-[11px] text-slate">{children}</kbd>
  );
}
