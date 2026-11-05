"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/fx";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(choice: ThemeChoice) {
  return choice === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
}

/** Applies the saved appearance while the app is mounted; the marketing site keeps its own look. */
export function useAppTheme() {
  React.useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.setAttribute("data-theme", resolve(read()));
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => read() === "system" && apply();
    const onChoice = () => apply();
    mq.addEventListener("change", onSystem);
    window.addEventListener("locentio-theme", onChoice);
    window.addEventListener("storage", onChoice);
    return () => {
      mq.removeEventListener("change", onSystem);
      window.removeEventListener("locentio-theme", onChoice);
      window.removeEventListener("storage", onChoice);
      root.removeAttribute("data-theme");
    };
  }, []);
}

const options: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** Light / Dark / System switch. Saved in this browser. */
function subscribe(cb: () => void) {
  window.addEventListener("locentio-theme", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("locentio-theme", cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle({ withLabels = false, className }: { withLabels?: boolean; className?: string }) {
  const choice = React.useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  const pick = (c: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, c);
    } catch {
      // storage blocked: still apply for this page view
    }
    document.documentElement.setAttribute("data-theme", resolve(c));
    window.dispatchEvent(new Event("locentio-theme"));
  };
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("inline-flex rounded-lg border border-line bg-canvas p-0.5", className)}>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={choice === id}
          aria-label={withLabels ? undefined : label}
          title={label}
          onClick={() => pick(id)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            choice === id ? "bg-surface text-ink shadow-sm" : "text-slate hover:text-ink",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {withLabels ? label : null}
        </button>
      ))}
    </div>
  );
}
