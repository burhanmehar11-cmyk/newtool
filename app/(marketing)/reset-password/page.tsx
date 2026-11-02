import type { Metadata } from "next";
import { AuthCard, NotConfigured } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/auth-forms";
import { supabaseConfig } from "@/server/env";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  const configured = !!supabaseConfig();
  return <AuthCard title="Choose a new password">{configured ? <ResetPasswordForm /> : <NotConfigured />}</AuthCard>;
}
