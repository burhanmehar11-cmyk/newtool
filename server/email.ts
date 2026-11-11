import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { brand } from "@/config/brand";
import { adminEmails } from "@/lib/admin";
import { buildMessage, toGmailRaw } from "@/lib/gmail/mime";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { sendRaw } from "@/server/gmail/google";

/**
 * Account emails (confirmations, password resets, team invites).
 *
 * Sent over SMTP when SMTP_URL is set, for example a Gmail App Password:
 *   SMTP_URL=smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465
 * Otherwise through the owner's Gmail mailbox already connected in Locenti
 * (send-only access): SYSTEM_EMAIL_FROM if set, else a connected mailbox in a
 * workspace owned by someone in ADMIN_EMAILS. Never a customer's mailbox.
 */
export function smtpConfigured() {
  return !!process.env.SMTP_URL?.trim();
}

type SystemMailbox = { id: string; email: string; sender_name: string | null };
let mailboxCache: { at: number; value: SystemMailbox | null } | null = null;

async function systemMailbox(): Promise<SystemMailbox | null> {
  if (mailboxCache && Date.now() - mailboxCache.at < 60_000) return mailboxCache.value;
  const explicit = process.env.SYSTEM_EMAIL_FROM?.trim().toLowerCase() ?? "";
  const admins = adminEmails();
  let value: SystemMailbox | null = null;
  let looked = false;
  if (explicit || admins.length) {
    try {
      value =
        (
          await withService((q) =>
            (q as unknown as Q).query<SystemMailbox>(
              `select sa.id, sa.email, sa.sender_name from public.sending_accounts sa
               where sa.status = 'connected' and coalesce(sa.scopes, '') like '%gmail.send%'
                 and (case when $1 <> '' then lower(sa.email) = $1
                      else exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
                                   where m.workspace_id = sa.workspace_id and m.role = 'owner' and lower(u.email) = any($2::text[])) end)
               order by sa.created_at limit 1`,
              [explicit, admins],
            ),
          )
        ).rows[0] ?? null;
      looked = true;
    } catch (e) {
      // A slow or failed lookup must not switch email off for everyone: don't remember it.
      console.error("[email] couldn't look up the sending mailbox:", (e as Error).message);
      return null;
    }
  } else looked = true;
  if (looked) mailboxCache = { at: Date.now(), value };
  return value;
}

/** Can Locenti send account emails right now (SMTP, or the owner's connected Gmail)? */
export async function emailAvailable(): Promise<boolean> {
  return smtpConfigured() || !!(await systemMailbox());
}

/** How account emails go out, for the admin panel. */
export async function emailChannel(): Promise<{ kind: "smtp" } | { kind: "gmail"; email: string } | { kind: "none" }> {
  if (smtpConfigured()) return { kind: "smtp" };
  const m = await systemMailbox();
  return m ? { kind: "gmail", email: m.email } : { kind: "none" };
}

let transport: Transporter | null = null;

/**
 * `from` asks for a different sender address (e.g. hello@locenti.com). Over
 * SMTP it's used as is; through Gmail it only shows if that address is set up
 * in Gmail as "Send mail as", otherwise Gmail shows the mailbox's own address.
 */
export type SendOptions = { replyTo?: string; headers?: Record<string, string>; from?: string; html?: string };

export async function sendEmail(to: string, subject: string, text: string, opts: SendOptions = {}) {
  const url = process.env.SMTP_URL?.trim();
  if (url) {
    transport ??= nodemailer.createTransport(url);
    const from = opts.from || process.env.EMAIL_FROM?.trim() || decodeURIComponent(new URL(url).username) || undefined;
    await transport.sendMail({ from: from ? `${brand.name} <${from}>` : undefined, to, subject, text, html: opts.html, replyTo: opts.replyTo, headers: opts.headers });
    return;
  }
  const box = await systemMailbox();
  if (!box) throw new Error("Email is not configured");
  const { accessTokenFor } = await import("@/server/services/mailboxes");
  const token = await accessTokenFor(box.id);
  if (!token.ok) {
    mailboxCache = null;
    throw new Error(token.message);
  }
  const sent = await sendRaw(token.token, toGmailRaw(buildMessage({ from: { email: opts.from || box.email, name: brand.name }, to, subject, text, html: opts.html ?? null, replyTo: opts.replyTo ?? null, headers: opts.headers })));
  if (!sent.ok) throw new Error(sent.message);
}

export function verifyEmailText(link: string) {
  return `Confirm your email to finish creating your ${brand.name} account:\n\n${link}\n\nThe link works once and expires in 24 hours. If you didn't sign up, ignore this email.`;
}

export function resetEmailText(link: string) {
  return `Use this link to choose a new ${brand.name} password:\n\n${link}\n\nIt works once and expires in 1 hour. If you didn't ask for this, ignore this email; your password stays the same.`;
}

export function existingAccountText(signInLink: string, resetLink: string) {
  return `Someone (hopefully you) tried to create a ${brand.name} account with this email, but you already have one.\n\nSign in: ${signInLink}\nForgot your password? ${resetLink}`;
}
