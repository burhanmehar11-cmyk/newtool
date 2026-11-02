import type { Metadata } from "next";
import { AuthCard, NotConfigured } from "@/features/auth/auth-card";
import { ForgotPasswordForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  const configured = accountsConfigured();
  return (
    <AuthCard title="Reset your password" description={configured ? "We'll email you a link to choose a new password. The link opens a secure Google-hosted page." : undefined}>
      {configured ? <ForgotPasswordForm /> : <NotConfigured />}
    </AuthCard>
  );
}
