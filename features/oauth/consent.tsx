"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { answerAuthorizeAction } from "@/server/actions/oauth";

const CAN = [
  "Search Google Maps and save businesses as leads",
  "Read your leads, their website research and replies",
  "Write email drafts and create draft campaigns",
];
const CANNOT = ["Send any email: you review and approve campaigns in Locenti", "See your password or mailbox passwords"];

function Submit({ decision, children, variant }: { decision: "allow" | "deny"; children: React.ReactNode; variant?: "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="decision" value={decision} variant={variant} disabled={pending} className="flex-1">
      {pending && decision === "allow" ? <Loader2 aria-hidden className="animate-spin" /> : null} {children}
    </Button>
  );
}

export function Consent({ appName, appHost, params, workspaces, email }: { appName: string; appHost: string; params: string; workspaces: { id: string; name: string; role: string }[]; email: string | null }) {
  return (
    <form action={answerAuthorizeAction} className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-float sm:p-8">
      <input type="hidden" name="params" value={params} />
      <div className="flex items-center justify-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-midnight text-mint">
          <LogoMark className="size-6" />
        </span>
        <span aria-hidden className="text-slate">⇄</span>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-canvas text-lg font-bold text-ink">{appName.slice(0, 1).toUpperCase()}</span>
      </div>
      <h1 className="mt-5 text-center font-display text-xl font-semibold text-ink">Connect {appName} to Locenti</h1>
      <p className="mt-1 text-center text-sm text-slate">
        {appHost} wants to work in your Locenti workspace{email ? ` as ${email}` : ""}.
      </p>

      <div className="mt-5 space-y-1.5">
        <Label htmlFor="ws">Workspace</Label>
        <Select id="ws" name="workspace" defaultValue={workspaces[0]?.id}>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.role})
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-5 rounded-2xl bg-canvas/70 p-4 text-sm">
        <p className="font-semibold text-ink">{appName} will be able to:</p>
        <ul className="mt-2 space-y-1.5">
          {CAN.map((c) => (
            <li key={c} className="flex gap-2 text-ink">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-green" /> {c}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-semibold text-ink">It can&apos;t:</p>
        <ul className="mt-2 space-y-1.5">
          {CANNOT.map((c) => (
            <li key={c} className="flex gap-2 text-slate">
              <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-fg" /> {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex gap-2">
        <Submit decision="deny" variant="secondary">
          Cancel
        </Submit>
        <Submit decision="allow">Allow</Submit>
      </div>
      <p className="mt-4 flex items-start gap-1.5 text-xs leading-5 text-slate">
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" /> You can disconnect it any time on the Agent page in Locenti. Only allow apps you trust.
      </p>
    </form>
  );
}
