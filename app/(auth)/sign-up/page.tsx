import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard subtitle="Create your workspace account" footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <SignUpForm emailEnabled />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
