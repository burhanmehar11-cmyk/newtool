import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageLoading } from "@/features/product/page-loading";
import { ProductOnboarding } from "@/features/product/product-forms";
import { listWorkspaces, requireUser } from "@/server/auth";
import { getMyInvites } from "@/server/services/team";
import { PendingInvites } from "@/features/team/accept-invite";
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
  const [existing, invites] = await Promise.all([listWorkspaces(), getMyInvites()]);
  // One workspace per person: anyone who already has one goes to it (teammates are added from Team).
  if (existing.length) redirect("/app");
  return (
    <div>
      {invites.length ? <PendingInvites invites={invites} /> : null}
      <ProductOnboarding
        defaultValues={{ workspaceName: "", ...emptyOfferProfile }}
      />
    </div>
  );
}
