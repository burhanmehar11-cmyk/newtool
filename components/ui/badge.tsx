import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-4 whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-ink/[0.06] text-ink",
        green: "bg-mint-soft text-green",
        warn: "bg-warn-bg text-warn-fg",
        danger: "bg-danger-bg text-danger-fg",
        info: "bg-info-bg text-info-fg",
        demo: "bg-demo-bg text-demo-fg ring-1 ring-demo-fg/15",
        outline: "ring-1 ring-inset ring-line-strong/50 text-slate",
        dark: "bg-white/[0.08] text-white/85",
        "mint-dark": "bg-mint/15 text-mint",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
