"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { demo, useDemo } from "@/demo/store";
import { setUi } from "@/demo/ui";
import { CampaignStatusBadge } from "@/features/campaigns/status";
import { cn } from "@/lib/utils";

/** Explicit enrolment: leads only join a campaign through this dialog. */
export function AddToCampaignDialog({
  leadIds,
  open,
  onOpenChange,
  onDone,
}: {
  leadIds: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const s = useDemo();
  const router = useRouter();
  const { push } = useToast();
  const editable = s.campaigns.filter((c) => c.status === "draft" || c.status === "paused");
  const [choice, setChoice] = React.useState<string>("new");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    setError(null);
    let id = choice;
    if (choice === "new") {
      if (name.trim().length < 2) {
        setError("Give the campaign a name.");
        return;
      }
      id = demo.createCampaign(name, leadIds);
    } else {
      const r = demo.addToCampaign(choice, leadIds);
      if (!r.ok) {
        setError(r.reason ?? "Could not add to this campaign.");
        return;
      }
    }
    push({ tone: "success", title: `Added ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} to a draft campaign`, body: "Nothing is sent until you approve and launch it." });
    setName("");
    onOpenChange(false);
    onDone?.();
    setUi({ campaignId: id });
    router.push("/demo/campaigns");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Add ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} to a campaign`}
        description="Leads are only contacted after you approve the campaign. Eligibility is checked again before every send."
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Campaign</legend>
          <div className={cn("rounded-xl border p-3", choice === "new" ? "border-green bg-mint-soft/40" : "border-line")}>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="radio" name="camp" value="new" checked={choice === "new"} onChange={() => setChoice("new")} className="accent-green" />
              <span className="text-sm font-medium text-ink">New draft campaign</span>
            </label>
            {choice === "new" ? (
              <div className="mt-2 pl-7">
                <Label htmlFor="new-camp-name" className="sr-only">
                  Campaign name
                </Label>
                <Input id="new-camp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Austin dental · booking" autoFocus />
              </div>
            ) : null}
          </div>
          {editable.map((c) => (
            <label key={c.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3", choice === c.id ? "border-green bg-mint-soft/40" : "border-line")}>
              <input type="radio" name="camp" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} className="accent-green" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                <span className="text-xs text-slate">{c.leadIds.length} recipients</span>
              </span>
              <CampaignStatusBadge status={c.status} />
            </label>
          ))}
        </fieldset>
        <FieldError className="mt-3">{error}</FieldError>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Add to campaign</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
