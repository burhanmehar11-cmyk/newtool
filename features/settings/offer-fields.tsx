"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { FieldError, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import type { OfferProfileInput } from "@/lib/domain/schemas";
import { offerTypeLabels } from "@/demo/research";

export type OfferFieldName = keyof OfferProfileInput;

type Props<T extends OfferProfileInput> = {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  fields: OfferFieldName[];
};

const help: Record<OfferFieldName, string> = {
  serviceType: "Briefs are scored against this. A clinic can be a strong lead for one offer and weak for another.",
  service: "In a few words, e.g. “Website redesign and online booking”.",
  targetCustomer: "Who you want to reach, e.g. “independent dental clinics”.",
  valueProp: "One or two sentences on the outcome you deliver. Used in drafts. Avoid guarantees.",
  tone: "Sets the starting style of drafts. You can edit every draft.",
  senderName: "Shown to recipients.",
  senderTitle: "Optional.",
  companyName: "Shown in every signature.",
  businessAddress: "Many markets expect a physical business address in commercial email.",
  bookingLink: "Optional. Added to call-to-action lines when present.",
};

const labels: Record<OfferFieldName, string> = {
  serviceType: "What kind of service do you sell?",
  service: "Service",
  targetCustomer: "Target customer",
  valueProp: "Value proposition",
  tone: "Preferred tone",
  senderName: "Sender name",
  senderTitle: "Sender title",
  companyName: "Company name",
  businessAddress: "Business address",
  bookingLink: "Booking link",
};

/** Offer-profile fields shared by onboarding and settings. */
export function OfferFields<T extends OfferProfileInput>({ register, errors, fields }: Props<T>) {
  const reg = register as unknown as UseFormRegister<OfferProfileInput>;
  const errs = errors as FieldErrors<OfferProfileInput>;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((name) => {
        const id = `offer-${name}`;
        const err = errs[name]?.message;
        const wide = name === "valueProp" || name === "serviceType" || name === "tone" || name === "businessAddress";
        return (
          <div key={name} className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
            <Label htmlFor={id}>{labels[name]}</Label>
            {name === "serviceType" ? (
              <Select id={id} {...reg(name)} aria-invalid={!!err}>
                {Object.entries(offerTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            ) : name === "tone" ? (
              <Select id={id} {...reg(name)} aria-invalid={!!err}>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
                <option value="consultative">Consultative</option>
              </Select>
            ) : name === "valueProp" ? (
              <Textarea id={id} rows={3} {...reg(name)} aria-invalid={!!err} />
            ) : (
              <Input id={id} {...reg(name)} aria-invalid={!!err} type={name === "bookingLink" ? "url" : "text"} placeholder={name === "bookingLink" ? "https://" : undefined} />
            )}
            {err ? <FieldError>{String(err)}</FieldError> : <FieldHint>{help[name]}</FieldHint>}
          </div>
        );
      })}
    </div>
  );
}
