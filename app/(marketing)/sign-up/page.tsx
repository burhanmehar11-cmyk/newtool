import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, NotConfigured } from "@/features/auth/auth-card";
import { GoogleSignIn } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Join the beta", robots: { index: false } };

export default function SignUpPage() {
  const configured = accountsConfigured();
  return (
    <AuthCard title="Join the private beta" description={configured ? "No password needed. Your account is created the first time you continue with an invited Google account." : undefined}>
      {configured ? (
        <Suspense>
          <GoogleSignIn />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
