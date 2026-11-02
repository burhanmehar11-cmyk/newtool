"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialog and side-sheet built on Radix Dialog: focus is trapped, Escape closes,
 * and focus returns to the trigger.
 */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay({ className }: { className?: string }) {
  return (
    <D.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-midnight/45 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out] data-[state=closed]:animate-[fade-out_160ms_ease-in]",
        className,
      )}
    />
  );
}

type ContentProps = React.ComponentProps<typeof D.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  hideTitle?: boolean;
};

export function DialogContent({ className, children, title, description, hideTitle, ...props }: ContentProps) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-float focus:outline-none data-[state=open]:animate-[dialog-in_200ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      >
        <div className="mb-4 pr-8">
          <D.Title className={cn("font-display text-lg font-semibold text-ink", hideTitle && "sr-only")}>{title}</D.Title>
          {description ? (
            <D.Description className="mt-1 text-sm leading-6 text-slate">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
          )}
        </div>
        {children}
        <D.Close className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-lg text-slate hover:bg-ink/5 hover:text-ink">
          <X className="size-4" aria-hidden />
          <span className="sr-only">Close</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function SheetContent({
  className,
  children,
  title,
  description,
  hideTitle,
  side = "right",
  dark,
  ...props
}: ContentProps & { side?: "right" | "left"; dark?: boolean }) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col shadow-float focus:outline-none",
          side === "right"
            ? "right-0 max-w-[min(100vw,600px)] border-l data-[state=open]:animate-[sheet-in-right_220ms_var(--ease-out-soft)]"
            : "left-0 max-w-[300px] border-r data-[state=open]:animate-[sheet-in-left_220ms_var(--ease-out-soft)]",
          dark ? "on-dark border-line-dark bg-midnight text-white" : "border-line bg-surface",
          className,
        )}
        {...props}
      >
        <D.Title className={cn(hideTitle ? "sr-only" : "sr-only")}>{title}</D.Title>
        {description ? (
          <D.Description className="sr-only">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{typeof title === "string" ? title : "Panel"}</D.Description>
        )}
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function SheetCloseButton({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <D.Close
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg",
        dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-slate hover:bg-ink/5 hover:text-ink",
        className,
      )}
    >
      <X className="size-[18px]" aria-hidden />
      <span className="sr-only">Close panel</span>
    </D.Close>
  );
}
