"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { setPlanAction } from "@/server/actions/admin";

const LABELS = { trial: "Trial", free: "Free", paid: "Paid", comp: "Complimentary" } as const;

/** Inline editor for a workspace's plan (manual until billing exists; every change is audited). */
export function PlanEditor({ workspaceId, plan, trialEndsAt, note }: { workspaceId: string; plan: string; trialEndsAt: string; note: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [p, setP] = React.useState(plan);
  const [end, setEnd] = React.useState(trialEndsAt.slice(0, 10));
  const [n, setN] = React.useState(note ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-green hover:underline">
        <Pencil aria-hidden className="size-3" /> Edit
      </button>
    );
  return (
    <form
      className="mt-2 grid min-w-[240px] gap-2 rounded-xl border border-line bg-canvas p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await setPlanAction({ workspaceId, plan: p, trialEndsAt: p === "trial" ? end : null, note: n.trim() || null });
          if (r.ok) {
            setOpen(false);
            router.refresh();
          } else setError(r.error);
        });
      }}
    >
      <Label htmlFor={`plan-${workspaceId}`} className="mb-0 text-xs">
        Plan
      </Label>
      <Select id={`plan-${workspaceId}`} value={p} onChange={(e) => setP(e.target.value)} className="h-9">
        {Object.entries(LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </Select>
      {p === "trial" ? (
        <>
          <Label htmlFor={`end-${workspaceId}`} className="mb-0 text-xs">
            Trial ends
          </Label>
          <Input id={`end-${workspaceId}`} type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
        </>
      ) : null}
      <Label htmlFor={`note-${workspaceId}`} className="mb-0 text-xs">
        Note (optional)
      </Label>
      <Input id={`note-${workspaceId}`} value={n} maxLength={300} placeholder="e.g. paid by invoice #12" onChange={(e) => setN(e.target.value)} className="h-9" />
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
