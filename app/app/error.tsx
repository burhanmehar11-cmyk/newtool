"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** App-wide error screen. Server error details stay in the server logs (matched by the reference). */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-danger-bg text-danger-fg">
        <TriangleAlert aria-hidden className="size-5" />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-ink">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm leading-6 text-slate">
        Something went wrong on our side. Try again in a moment; if it keeps happening, contact support.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden /> Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app">Go to Dashboard</Link>
        </Button>
      </div>
      {digest ? <p className="mt-5 font-mono text-[11px] text-slate">Reference: {digest}</p> : null}
    </div>
  );
}
