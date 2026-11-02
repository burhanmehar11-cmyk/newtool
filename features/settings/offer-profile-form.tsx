"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/misc";
import { offerProfileSchema, type OfferProfileInput } from "@/lib/domain/schemas";
import { OfferFields } from "./offer-fields";

export type SaveResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Offer-profile editor shared by the demo and the product. */
export function OfferProfileForm({
  defaultValues,
  savedType,
  onSave,
}: {
  defaultValues: OfferProfileInput;
  savedType: OfferProfileInput["serviceType"] | null;
  onSave: (values: OfferProfileInput) => Promise<SaveResult>;
}) {
  const form = useForm<OfferProfileInput>({ resolver: zodResolver(offerProfileSchema), defaultValues });
  const [status, setStatus] = React.useState<{ tone: "green" | "danger"; text: string } | null>(null);
  const watchedType = useWatch({ control: form.control, name: "serviceType" });
  const typeChanged = savedType !== null && watchedType !== savedType;

  return (
    <form
      onSubmit={form.handleSubmit(async (v) => {
        setStatus(null);
        const r = await onSave(v);
        if (r.ok) {
          form.reset(v);
          setStatus({ tone: "green", text: "Offer profile saved." });
        } else {
          for (const [k, msg] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof OfferProfileInput, { message: msg });
          setStatus({ tone: "danger", text: r.error });
        }
      })}
      className="space-y-5"
      noValidate
    >
      <OfferFields
        register={form.register}
        errors={form.formState.errors}
        fields={["serviceType", "service", "targetCustomer", "valueProp", "tone", "senderName", "senderTitle", "companyName", "businessAddress", "bookingLink"]}
      />
      {typeChanged ? <Callout tone="warn">Briefs already generated will be marked outdated until you research again.</Callout> : null}
      {status ? (
        <Callout tone={status.tone} className="py-2">
          <span role={status.tone === "danger" ? "alert" : "status"}>{status.text}</span>
        </Callout>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Save offer profile"}
        </Button>
        <Button type="button" variant="secondary" disabled={!form.formState.isDirty} onClick={() => form.reset()}>
          Discard changes
        </Button>
      </div>
    </form>
  );
}
