"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Progress } from "@/components/ui/misc";
import { Callout } from "@/components/ui/misc";
import { onboardingSchema } from "@/lib/domain/schemas";
import type { z } from "zod";
import { OfferFields, type OfferFieldName } from "@/features/settings/offer-fields";

export type OnboardingValues = z.infer<typeof onboardingSchema>;
type Values = OnboardingValues;

export type SubmitResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const STEPS: { title: string; why: string; fields: (keyof Values)[] }[] = [
  { title: "Name your workspace", why: "Usually your agency or client name. You can change it later.", fields: ["workspaceName"] },
  { title: "What do you sell?", why: "Leads are scored against your offer, so the same business can be a strong fit for one service and weak for another.", fields: ["serviceType", "service"] },
  { title: "Who do you want to reach?", why: "Used to focus research and to phrase drafts. Keep the value proposition concrete and avoid promises.", fields: ["targetCustomer", "valueProp"] },
  { title: "How should drafts sound?", why: "A starting style only. You review and edit every draft before it can be approved.", fields: ["tone"] },
  { title: "Who is sending?", why: "Recipients see this identity. Many markets expect a real sender name and a physical business address.", fields: ["senderName", "senderTitle", "companyName", "businessAddress"] },
  { title: "Booking link (optional)", why: "If you add one, drafts can invite replies to pick a time. Leave it empty to ask for a reply instead.", fields: ["bookingLink"] },
];

/**
 * Step-by-step workspace setup. Used by the demo (saves to the local demo
 * store) and the product (saves through a server action).
 */
export function OnboardingWizard({
  defaultValues,
  onComplete,
  footnote,
}: {
  defaultValues: Values;
  onComplete: (values: Values) => Promise<SubmitResult>;
  footnote: string;
}) {
  const [step, setStep] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(onboardingSchema), mode: "onTouched", defaultValues });
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const go = (n: number) => {
    setStep(n);
    window.setTimeout(() => headingRef.current?.focus(), 0);
  };

  const next = async () => {
    const ok = await form.trigger(cur.fields);
    if (!ok) return;
    if (!last) return go(step + 1);
    await form.handleSubmit(async (v) => {
      setSubmitError(null);
      setSubmitting(true);
      try {
        const r = await onComplete(v);
        if (!r.ok) {
          setSubmitError(r.error);
          for (const [k, msg] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof Values, { message: msg });
          const firstBad = STEPS.findIndex((st) => st.fields.some((f) => r.fieldErrors?.[f]));
          if (firstBad >= 0) go(firstBad);
        }
      } catch {
        setSubmitError("Something went wrong while saving. Nothing was lost. Try again.");
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-slate">
        Step {step + 1} of {STEPS.length}
      </p>
      <Progress value={((step + 1) / STEPS.length) * 100} label="Onboarding progress" className="mt-2" />
      <form
        className="card mt-6 p-6 sm:p-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink focus:outline-none">
          {cur.title}
        </h1>
        <p className="mt-2 text-[15px] leading-7 text-slate">{cur.why}</p>
        <div className="mt-6">
          {cur.fields.includes("workspaceName") ? (
            <div className="space-y-1.5">
              <Label htmlFor="ob-ws">Workspace name</Label>
              <Input id="ob-ws" {...form.register("workspaceName")} aria-invalid={!!form.formState.errors.workspaceName} autoFocus />
              {form.formState.errors.workspaceName ? <FieldError>{form.formState.errors.workspaceName.message}</FieldError> : <FieldHint>e.g. Northline Studio</FieldHint>}
            </div>
          ) : (
            <OfferFields register={form.register} errors={form.formState.errors} fields={cur.fields as OfferFieldName[]} />
          )}
        </div>
        {submitError ? (
          <Callout tone="danger" className="mt-6">
            {submitError}
          </Callout>
        ) : null}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          <Button type="submit" disabled={submitting}>
            {last ? (
              <>
                <Check aria-hidden /> Finish setup
              </>
            ) : (
              <>
                Continue <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-slate">{footnote}</p>
    </div>
  );
}
