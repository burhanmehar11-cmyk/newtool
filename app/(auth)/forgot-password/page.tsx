import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { ForgotPasswordForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";


export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard subtitle="We'll email you a link to choose a new password" footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
