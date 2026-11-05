import mark from "@/lib/brand-mark.json";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** The Locenti mark. Inherits `currentColor`, so it works in any single color. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={mark.viewBox}
      className={cn("size-6", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {mark.paths.map((p, i) =>
        p.type === "circle" ? (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="currentColor" />
        ) : (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  );
}

/** Mark + live-text wordmark (Manrope). For static files see public/brand. */
export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-[26px]", tone === "dark" ? "text-mint" : "text-green")} />
      <span
        className={cn(
          "font-display text-[19px] font-extrabold tracking-[-0.03em]",
          tone === "dark" ? "text-white" : "text-ink",
        )}
      >
        {brand.name}
      </span>
    </span>
  );
}
