import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        /** Deep green: primary action on light surfaces. */
        primary: "bg-green text-white hover:bg-green-hover shadow-[0_1px_0_rgb(255_255_255/0.12)_inset]",
        /** Mint: primary action on dark surfaces. */
        mint: "bg-mint text-midnight hover:bg-mint-strong",
        secondary: "border border-line-strong/60 bg-surface text-ink hover:bg-canvas hover:border-line-strong",
        ghost: "text-ink hover:bg-ink/[0.05]",
        "ghost-dark": "text-white/90 hover:bg-white/[0.08] hover:text-white",
        "outline-dark": "border border-white/20 text-white hover:bg-white/[0.06] hover:border-white/35",
        danger: "bg-danger-fg text-white hover:bg-danger-fg/90",
        link: "h-auto px-0 text-green underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(!asChild ? { type: type ?? "button" } : {})}
      {...props}
    />
  );
}
