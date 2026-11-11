import "server-only";
import { addedAdmins, grantAdmin, isOwnerEmail, isPlatformAdmin, revokeAdmin } from "@/server/admin-access";
import { brand } from "@/config/brand";
import { emailChannel, sendEmail } from "@/server/email";
import { configuredSiteUrl } from "@/server/env";
import { track } from "@/server/events";
import { notFound } from "next/navigation";
import { z } from "zod";
import { adminEmails, trialDays } from "@/lib/admin";
import { getCurrentUser, requireUser } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { dailyLimit, googlePlacesConfigured } from "@/server/providers/google-places";
import { aiWriterStatus } from "@/server/services/ai-writer";
import * as store from "@/server/admin-store";
import { revenue } from "@/server/billing-store";
import { billingConfig } from "@/server/services/billing";

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));

/** For pages: signed in as an owner (ADMIN_EMAILS) or an added admin, or a 404 (the panel's existence isn't revealed). */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!(await isPlatformAdmin(user.email))) notFound();
  return user;
}

/** Owners only (ADMIN_EMAILS): managing who else is an admin. */
export async function requireOwner() {
  const user = await requireAdmin();
  if (!isOwnerEmail(user.email)) return null;
  return user;
}

/** For the app shell: show the Admin link? */
export async function isAdmin() {
  const user = await getCurrentUser();
  return isPlatformAdmin(user?.email);
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

/** Gives someone access to the admin panel (owners only). They sign in with that email. */
export async function addPlatformAdmin(email: unknown): Promise<{ ok: true; emailed: boolean } | { ok: false; error: string }> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Only owners can add admins." };
  const e = emailSchema.safeParse(email);
  if (!e.success) return { ok: false, error: e.error.issues[0].message };
  if (isOwnerEmail(e.data)) return { ok: false, error: "That person is already an owner." };
  let added: boolean;
  try {
    added = await svc((q) => grantAdmin(q, e.data, owner.email ?? "owner"));
  } catch {
    return { ok: false, error: "Run the database update 0020_admin_users.sql in Neon first." };
  }
  if (!added) return { ok: false, error: "That person is already an admin." };
  const site = configuredSiteUrl() ?? brand.siteUrl;
  const emailed = await sendEmail(
    e.data,
    "You now have admin access to Locenti",
    `Hi,\n\n${owner.email} gave you admin access to Locenti: the admin panel with activity, support, people, announcements and more.\n\nOpen it here (sign in with this email address): ${site}/admin\n\nHappy Sending,\nThe Locenti Team`,
    { from: process.env.ANNOUNCE_FROM?.trim() || brand.supportEmail, replyTo: brand.supportEmail },
  )
    .then(() => true)
    .catch(() => false);
  await track({ email: owner.email, kind: "admin_granted", area: "team", outcome: "success", summary: `Gave admin access to ${e.data}` });
  return { ok: true, emailed };
}

/** Removes an added admin (owners only; owners themselves are set in ADMIN_EMAILS). */
export async function removePlatformAdmin(email: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const owner = await requireOwner();
  if (!owner) return { ok: false, error: "Only owners can remove admins." };
  const e = emailSchema.safeParse(email);
  if (!e.success) return { ok: false, error: "Not found." };
  if (isOwnerEmail(e.data)) return { ok: false, error: "Owners are set in ADMIN_EMAILS in Vercel and can't be removed here." };
  const ok = await svc((q) => revokeAdmin(q, e.data, owner.email ?? "owner")).catch(() => false);
  if (ok) await track({ email: owner.email, kind: "admin_revoked", area: "team", outcome: "info", summary: `Removed admin access from ${e.data}` });
  return ok ? { ok: true } : { ok: false, error: "That person isn't an admin." };
}

export const ADMIN_TABS = ["overview", "activity", "support", "funnel", "users", "workspaces", "usage", "emails", "announcements", "apis", "revenue", "admins"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export async function getAdminTab(tab: AdminTab, days: number, search: string, filter = "all") {
  await requireAdmin();
  const trial = trialDays();
  // One connection per request: queries run one after another.
  return svc(async (q) => {
    switch (tab) {
      case "overview":
        return { tab, overview: await store.overview(q, trial), daily: await store.daily(q, days), sources: (await store.sources(q, days)).slice(0, 6), trial };
      case "activity": {
        const f = (store.ACTIVITY_FILTERS as readonly string[]).includes(filter) ? (filter as store.ActivityFilter) : "all";
        return { tab, filter: f, rows: await store.activity(q, f, search), counts: await store.signupCounts(q), outcomes: await store.outcomeCounts(q) };
      }
      case "funnel":
        return { tab, funnel: await store.signupFunnel(q, days), sources: await store.sources(q, days), campaigns: await store.campaignsBySignups(q, days) };
      case "users":
        return { tab, users: await store.users(q, search) };
      case "workspaces":
        return { tab, workspaces: await store.workspaces(q, trial, search), trial };
      case "usage":
        return { tab, daily: await store.daily(q, days) };
      case "emails":
        return { tab, stats: await store.emailStats(q, days), daily: await store.daily(q, days), problems: await store.mailboxProblems(q), channel: await emailChannel() };
      case "apis":
        return { tab, apis: await store.sharedApis(q, days), placesLimit: dailyLimit(), placesOn: googlePlacesConfigured(), aiOn: aiWriterStatus().configured };
      case "revenue": {
        const billing = await revenue(q, days).then((r) => ({ ready: true as const, ...r })).catch(() => ({ ready: false as const }));
        const cfg = billingConfig();
        return { tab, overview: await store.overview(q, trial), paying: (await store.workspaces(q, trial, "")).filter((w) => w.plan === "paid" || w.plan === "comp"), billing, configured: { checkout: cfg.checkoutReady, webhook: cfg.webhookReady, environment: cfg.environment, enforce: cfg.enforce } };
      }
      case "support":
      case "announcements":
        // Loaded by its own section (it sends email, so it has its own service).
        return { tab };
      case "admins": {
        const owners = adminEmails();
        const added = await addedAdmins();
        const emails = [...owners, ...added.map((a) => a.email)];
        const accounts = await store.accountsFor(q, emails);
        const me = (await requireAdmin()).email;
        return {
          tab,
          canManage: isOwnerEmail(me),
          admins: emails.map((e) => {
            const a = added.find((x) => x.email === e);
            return { email: e, owner: owners.includes(e), addedBy: a?.added_by ?? null, addedAt: a?.created_at ?? null, lastSignIn: accounts.find((x) => x.email === e)?.last_sign_in_at ?? null, hasAccount: accounts.some((x) => x.email === e) };
          }),
          audit: await store.auditLog(q),
        };
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
