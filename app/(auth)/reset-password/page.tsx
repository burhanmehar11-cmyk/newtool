import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";


export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard subtitle="Choose a new password for your account" footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
