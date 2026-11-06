import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { SignInForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard subtitle="Sign in to your workspace" footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <SignInForm emailEnabled />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
