import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, NotConfigured } from "@/features/auth/auth-card";
import { SignInForm } from "@/features/auth/auth-forms";
import { supabaseConfig } from "@/server/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  const configured = !!supabaseConfig();
  return (
    <AuthCard title="Sign in" description={configured ? "Private beta workspaces." : undefined}>
      {configured ? (
        <Suspense>
          <SignInForm />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}
