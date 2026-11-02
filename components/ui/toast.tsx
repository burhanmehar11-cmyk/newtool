"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; tone: Tone; title: string; body?: string };

const ToastCtx = React.createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

/**
 * Minimal toast system. Errors are never shown as success, and error toasts stay
 * until dismissed. Announced politely (or assertively for errors) to screen readers.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++idRef.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      if (t.tone !== "error") window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        <div aria-live="polite" className="contents">
          {items
            .filter((t) => t.tone !== "error")
            .map((t) => (
              <ToastCard key={t.id} item={t} onDismiss={dismiss} />
            ))}
        </div>
        <div aria-live="assertive" className="contents">
          {items
            .filter((t) => t.tone === "error")
            .map((t) => (
              <ToastCard key={t.id} item={t} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? AlertTriangle : Info;
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-float"
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          item.tone === "success" && "text-green",
          item.tone === "error" && "text-danger-fg",
          item.tone === "info" && "text-info-fg",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{item.title}</p>
        {item.body ? <p className="mt-0.5 text-[13px] leading-5 text-slate">{item.body}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="-m-1 rounded-md p-1 text-slate hover:bg-ink/5 hover:text-ink"
      >
        <X className="size-3.5" aria-hidden />
        <span className="sr-only">Dismiss notification</span>
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
