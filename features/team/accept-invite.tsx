"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { acceptInviteAction } from "@/server/actions/team";
import type { MyInvite } from "@/server/team-store";

export function AcceptInviteButton({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <div className="mt-6">
      <Button
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await acceptInviteAction(token);
            if (!r.ok) setError(r.error); // on success the action redirects to the dashboard
          })
        }
      >
        {pending ? "Joining…" : `Join ${workspaceName}`}
      </Button>
      {error ? <FieldError className="mt-2">{error}</FieldError> : null}
    </div>
  );
}

/** Onboarding: join a workspace you were invited to instead of creating one. */
export function PendingInvites({ invites }: { invites: MyInvite[] }) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <section className="card mx-auto mb-6 max-w-2xl p-5">
      <h2 className="font-display text-lg font-semibold text-ink">You&apos;ve been invited</h2>
      <p className="mt-1 text-sm text-slate">Join your team&apos;s workspace, or create your own below.</p>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-ink">{i.workspace_name}</span>
              <span className="block text-xs text-slate">as {i.role === "admin" ? "an admin" : "a member"}</span>
            </span>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await acceptInviteAction(i.id, "id");
                  if (!r.ok) setError(r.error); // on success the action redirects to the dashboard
                })
              }
            >
              Join
            </Button>
          </li>
        ))}
      </ul>
      {error ? <FieldError className="mt-2">{error}</FieldError> : null}
    </section>
  );
}
