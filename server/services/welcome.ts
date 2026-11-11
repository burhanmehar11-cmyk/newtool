import "server-only";
import { brand } from "@/config/brand";
import { trialDays } from "@/lib/admin";
import { firstNameOf } from "@/lib/announcements";
import { welcomeEmail } from "@/lib/welcome-email";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { sendEmail } from "@/server/email";
import { configuredSiteUrl } from "@/server/env";
import { track } from "@/server/events";

/**
 * Sends the welcome email once, to a new account: called when an email
 * sign-up is confirmed and after every Google sign-in. Claims the account
 * first (welcomed_at), so two sign-ins at once can't both send it, and only
 * accounts created in the last day qualify, so existing users never get it
 * later. If sending fails the claim is released and the next sign-in tries
 * again. Never throws.
 */
export async function sendWelcomeEmail(userId: string): Promise<"sent" | "skipped" | "failed"> {
  const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
  let who: { email: string; name: string | null } | undefined;
  try {
    who = (
      await svc((q) =>
        q.query<{ email: string; name: string | null }>(
          `update auth.users set welcomed_at = now()
           where id = $1 and welcomed_at is null and email is not null and created_at > now() - interval '1 day'
             and (email_verified_at is not null or auth_subject like 'google:%')
           returning lower(email) as email, coalesce(nullif(raw_user_meta_data->>'full_name', ''), nullif(raw_user_meta_data->>'name', '')) as name`,
          [userId],
        ),
      )
    ).rows[0];
  } catch {
    return "skipped"; // e.g. migration 0018 not run yet
  }
  if (!who) return "skipped";
  const site = configuredSiteUrl() ?? brand.siteUrl;
  const m = welcomeEmail({ firstName: firstNameOf(who.name, who.email), site, trialDays: trialDays(), replyTo: brand.supportEmail });
  try {
    await sendEmail(who.email, m.subject, m.text, { html: m.html, replyTo: brand.supportEmail, from: process.env.ANNOUNCE_FROM?.trim() || brand.supportEmail });
    await track({ userId, kind: "welcome_sent", area: "account", outcome: "success", summary: "Welcome email sent" });
    return "sent";
  } catch (e) {
    await svc((q) => q.query("update auth.users set welcomed_at = null where id = $1", [userId])).catch(() => undefined);
    await track({ userId, kind: "welcome_failed", area: "account", outcome: "failed", summary: `Welcome email couldn't be sent: ${(e as Error).message}` });
    return "failed";
  }
}

/** The welcome email exactly as a new user gets it, sent to an admin (preview). */
export async function sendWelcomePreview(to: string, name: string | null = null) {
  const site = configuredSiteUrl() ?? brand.siteUrl;
  const m = welcomeEmail({ firstName: firstNameOf(name, to), site, trialDays: trialDays(), replyTo: brand.supportEmail });
  await sendEmail(to, `[Preview] ${m.subject}`, m.text, { html: m.html, replyTo: brand.supportEmail, from: process.env.ANNOUNCE_FROM?.trim() || brand.supportEmail });
}
