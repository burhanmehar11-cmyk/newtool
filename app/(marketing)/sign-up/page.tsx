import type { Metadata } from "next";
import { AuthCard, NotConfigured } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage() {
  const configured = accountsConfigured();
  return (
    <AuthCard title="Join the private beta" description={configured ? "Sign-up is open to invited email addresses during the beta." : undefined}>
      {configured ? <SignUpForm /> : <NotConfigured />}
    </AuthCard>
  );
}
