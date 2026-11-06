import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { SignInForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";
import { emailAvailable } from "@/server/email";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard subtitle="Sign in to your workspace" footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <SignInFormSlot />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}

async function SignInFormSlot() {
  await connection(); // the mailbox check reads the live database
  return <SignInForm emailEnabled={await emailAvailable()} />;
}
