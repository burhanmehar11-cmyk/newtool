import * as React from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-[10px] border border-line-strong/70 bg-surface text-sm text-ink placeholder:text-slate/80 transition-colors duration-200 hover:border-line-strong focus-visible:border-green focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-green/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-slate aria-[invalid=true]:border-danger-fg";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-10 px-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-10 appearance-none pl-3 pr-9", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-ink", className)} {...props} />;
}

export function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs leading-5 text-slate", className)} {...props} />;
}

export function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("text-xs font-medium text-danger-fg", className)} {...props}>
      {children}
    </p>
  );
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded-[4px] border-line-strong accent-green disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
