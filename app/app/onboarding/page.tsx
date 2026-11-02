import type { Metadata } from "next";
import { Suspense } from "react";
import { Callout } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { ProductOnboarding } from "@/features/product/product-forms";
import { listWorkspaces, requireUser } from "@/server/auth";
import { emptyOfferProfile } from "@/lib/domain/defaults";

export const metadata: Metadata = { title: "Set up your workspace" };

export default function ProductOnboardingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  await requireUser("/app/onboarding");
  const existing = await listWorkspaces();
  return (
    <div>
      {existing.length ? (
        <Callout tone="info" className="mx-auto mb-6 max-w-2xl">
          You already belong to {existing.length} workspace{existing.length === 1 ? "" : "s"}. Finishing this creates another one, for example for a client.
        </Callout>
      ) : null}
      <ProductOnboarding
        defaultValues={{ workspaceName: "", ...emptyOfferProfile }}
      />
    </div>
  );
}
