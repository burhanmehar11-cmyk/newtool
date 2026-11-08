import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/auth-forms";
import { accountsConfigured, signupOpen } from "@/server/env";
import { trialDays } from "@/lib/admin";

export const metadata: Metadata = { title: "Start your free trial", robots: { index: false } };

export default function Page() {
  const days = trialDays();
  return (
    <AuthCard subtitle={`Start your ${days}-day free trial`} footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <SignUpForm emailEnabled trialDays={days} open={signupOpen()} />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
