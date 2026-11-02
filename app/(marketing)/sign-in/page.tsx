import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, NotConfigured } from "@/features/auth/auth-card";
import { GoogleSignIn } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  const configured = accountsConfigured();
  return (
    <AuthCard title="Sign in" description={configured ? "Private beta. Use the Google account your invite was sent to." : undefined}>
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
