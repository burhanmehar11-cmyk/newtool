import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AuthCard, LegalNote, NotConfigured } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/auth-forms";
import { accountsConfigured } from "@/server/env";
import { emailAvailable } from "@/server/email";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function Page() {
  return (
    <AuthCard subtitle="Create your workspace account" footer={<LegalNote />}>
      {accountsConfigured() ? (
        <Suspense>
          <SignUpFormSlot />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </AuthCard>
  );
}

async function SignUpFormSlot() {
  await connection(); // the mailbox check reads the live database
  return <SignUpForm emailEnabled={await emailAvailable()} />;
}
