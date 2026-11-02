import type { Metadata } from "next";
import { OnboardingView } from "@/features/onboarding/onboarding-view";

export const metadata: Metadata = { title: "Set up your workspace" };

export default function Page() {
  return <OnboardingView />;
}
