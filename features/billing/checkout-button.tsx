"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaddleGlobal = {
  Environment: { set: (env: string) => void };
  Initialize: (opts: { token: string; eventCallback?: (e: { name?: string }) => void }) => void;
  Checkout: { open: (opts: { items: { priceId: string; quantity: number }[]; customer?: { email: string }; customData?: Record<string, string>; settings?: Record<string, unknown> }) => void };
};
declare global {
  interface Window {
    Paddle?: PaddleGlobal;
    __paddleReady?: boolean;
  }
}

const SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";

function loadPaddle(token: string, environment: "sandbox" | "production", onDone: () => void): Promise<PaddleGlobal> {
  return new Promise((resolve, reject) => {
    const ready = () => {
      const P = window.Paddle!;
      if (!window.__paddleReady) {
        if (environment === "sandbox") P.Environment.set("sandbox");
        P.Initialize({ token, eventCallback: (e) => e.name === "checkout.completed" && onDone() });
        window.__paddleReady = true;
      }
      resolve(P);
    };
    if (window.Paddle) return ready();
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = ready;
    s.onerror = () => reject(new Error("Couldn't load the checkout. Check your connection or ad blocker."));
    document.head.appendChild(s);
  });
}

/** Opens Paddle's checkout for a plan; the workspace id rides along so the webhook knows who paid. */
export function CheckoutButton({ priceId, workspaceId, email, clientToken, environment, label, variant = "primary" }: { priceId: string; workspaceId: string; email: string | null; clientToken: string; environment: "sandbox" | "production"; label: string; variant?: "primary" | "secondary" }) {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div>
      <Button
        className="w-full"
        variant={variant}
        disabled={state === "loading"}
        onClick={async () => {
          setState("loading");
          setError(null);
          try {
            const P = await loadPaddle(clientToken, environment, () => setState("done"));
            P.Checkout.open({ items: [{ priceId, quantity: 1 }], customer: email ? { email } : undefined, customData: { workspace_id: workspaceId } });
            setState("idle");
          } catch (e) {
            setState("error");
            setError((e as Error).message);
          }
        }}
      >
        {state === "loading" ? <Loader2 aria-hidden className="animate-spin" /> : null} {label}
      </Button>
      {state === "done" ? <p className="mt-2 text-xs text-green">Payment received. Your plan updates here within a minute; refresh to see it.</p> : null}
      {error ? <p className="mt-2 text-xs text-danger-fg">{error}</p> : null}
    </div>
  );
}
