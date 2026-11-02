"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { demo, useDemo } from "@/demo/store";
import { emptyOfferTemplate } from "@/demo/seed";
import { OnboardingWizard } from "./onboarding-wizard";

/** Demo onboarding: saves to the local demo store only. */
export function OnboardingView() {
  const s = useDemo();
  const router = useRouter();
  const { push } = useToast();
  return (
    <OnboardingWizard
      key={s.workspace.onboarded ? "edit" : "new"}
      defaultValues={{ workspaceName: s.workspace.onboarded ? s.workspace.name : "", ...(s.offer ?? emptyOfferTemplate) }}
      footnote="Saved in this browser only. This is a demo workspace."
      onComplete={async (v) => {
        const { workspaceName, ...offer } = v;
        demo.completeOnboarding(workspaceName, offer);
        push({ tone: "success", title: "Workspace ready", body: "You can change any of this later in Settings." });
        router.push("/demo/discover");
        return { ok: true };
      }}
    />
  );
}
