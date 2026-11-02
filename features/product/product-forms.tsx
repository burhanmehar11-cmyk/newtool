"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { OnboardingWizard, type OnboardingValues } from "@/features/onboarding/onboarding-wizard";
import { OfferProfileForm } from "@/features/settings/offer-profile-form";
import type { OfferProfileInput } from "@/lib/domain/schemas";
import { createWorkspaceAction, renameWorkspaceAction, saveOfferAction } from "@/server/actions/workspace";

export function ProductOnboarding({ defaultValues }: { defaultValues: OnboardingValues }) {
  const router = useRouter();
  return (
    <OnboardingWizard
      defaultValues={defaultValues}
      footnote="Saved to your workspace. You can change any of this later in Settings."
      onComplete={async (v) => {
        const r = await createWorkspaceAction(v);
        if (!r.ok) return r;
        router.push("/app");
        router.refresh();
        return { ok: true };
      }}
    />
  );
}

export function ProductOfferForm({ defaultValues, savedType }: { defaultValues: OfferProfileInput; savedType: OfferProfileInput["serviceType"] | null }) {
  const router = useRouter();
  return (
    <OfferProfileForm
      defaultValues={defaultValues}
      savedType={savedType}
      onSave={async (v) => {
        const r = await saveOfferAction(v);
        if (r.ok) router.refresh();
        return r.ok ? { ok: true } : r;
      }}
    />
  );
}

export function RenameWorkspaceForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(name);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        start(async () => {
          const r = await renameWorkspaceAction(value);
          if (!r.ok) setError(r.fieldErrors?.name ?? r.error);
          else {
            setError(null);
            setSaved(true);
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input id="ws-name" value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} />
        <FieldError>{error}</FieldError>
        {saved ? <p role="status" className="text-xs text-green">Saved.</p> : null}
        {!canEdit ? <p className="text-xs text-slate">Only the owner can rename the workspace.</p> : null}
      </div>
      <Button type="submit" disabled={!canEdit || pending || value.trim() === name}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
