import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminEmails, isAdminEmail, trialDays } from "@/lib/admin";
import { getCurrentUser, requireUser } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { emailConfigured } from "@/server/email";
import { dailyLimit, googlePlacesConfigured } from "@/server/providers/google-places";
import { aiWriterStatus } from "@/server/services/ai-writer";
import * as store from "@/server/admin-store";
import { revenue } from "@/server/billing-store";
import { billingConfig } from "@/server/services/billing";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));

/** For pages: signed in and listed in ADMIN_EMAILS, or a 404 (the panel's existence isn't revealed). */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!isAdminEmail(user.email)) notFound();
  return user;
}

/** For the app shell: show the Admin link? */
export async function isAdmin() {
  const user = await getCurrentUser();
  return isAdminEmail(user?.email);
}

export const ADMIN_TABS = ["overview", "funnel", "users", "workspaces", "usage", "emails", "apis", "revenue", "admins"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export async function getAdminTab(tab: AdminTab, days: number, search: string) {
  await requireAdmin();
  const trial = trialDays();
  // One connection per request: queries run one after another.
  return svc(async (q) => {
    switch (tab) {
      case "overview":
        return { tab, overview: await store.overview(q, trial), daily: await store.daily(q, days), sources: (await store.sources(q, days)).slice(0, 6), trial };
      case "funnel":
        return { tab, funnel: await store.signupFunnel(q, days), sources: await store.sources(q, days), campaigns: await store.campaignsBySignups(q, days) };
      case "users":
        return { tab, users: await store.users(q, search) };
      case "workspaces":
        return { tab, workspaces: await store.workspaces(q, trial, search), trial };
      case "usage":
        return { tab, daily: await store.daily(q, days) };
      case "emails":
        return { tab, stats: await store.emailStats(q, days), daily: await store.daily(q, days), problems: await store.mailboxProblems(q), smtp: emailConfigured() };
      case "apis":
        return { tab, apis: await store.sharedApis(q, days), placesLimit: dailyLimit(), placesOn: googlePlacesConfigured(), aiOn: aiWriterStatus().configured };
      case "revenue": {
        const billing = await revenue(q, days).then((r) => ({ ready: true as const, ...r })).catch(() => ({ ready: false as const }));
        const cfg = billingConfig();
        return { tab, overview: await store.overview(q, trial), paying: (await store.workspaces(q, trial, "")).filter((w) => w.plan === "paid" || w.plan === "comp"), billing, configured: { checkout: cfg.checkoutReady, webhook: cfg.webhookReady, environment: cfg.environment, enforce: cfg.enforce } };
      }
      case "admins": {
        const emails = adminEmails();
        const accounts = await store.accountsFor(q, emails);
        return { tab, admins: emails.map((e) => ({ email: e, lastSignIn: accounts.find((a) => a.email === e)?.last_sign_in_at ?? null, hasAccount: accounts.some((a) => a.email === e) })), audit: await store.auditLog(q) };
      }
    }
  });
}

const planInput = z.object({
  workspaceId: z.string().uuid(),
  plan: z.enum(["trial", "free", "paid", "comp", "lapsed"]),
  trialEndsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().trim().max(300).nullable(),
});

export async function setWorkspacePlan(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  const p = planInput.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the plan details." };
  const ok = await svc((q) =>
    store.setPlan(q, admin.email ?? "unknown", p.data.workspaceId, { plan: p.data.plan, trialEndsAt: p.data.trialEndsAt ? `${p.data.trialEndsAt}T23:59:59Z` : null, note: p.data.note || null }),
  );
  return ok ? { ok: true } : { ok: false, error: "Workspace not found." };
}
