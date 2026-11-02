"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Label, Select } from "@/components/ui/field";
import { switchWorkspaceAction } from "@/server/actions/workspace";

export function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: { id: string; name: string; role: string }[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const active = workspaces.find((w) => w.id === activeId);
  if (workspaces.length <= 1) {
    return (
      <div className="rounded-[10px] border border-line bg-canvas/70 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-ink">{active?.name ?? "No workspace yet"}</p>
        <p className="text-xs capitalize text-slate">{active ? active.role : "Finish setup to create one"}</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor="ws-switch" className="sr-only">
        Workspace
      </Label>
      <Select
        id="ws-switch"
        value={activeId ?? ""}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await switchWorkspaceAction(e.target.value);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </Select>
      {error ? <p className="text-xs text-danger-fg">{error}</p> : null}
    </div>
  );
}
