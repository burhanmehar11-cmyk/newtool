import "server-only";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ServerSettings } from "@/lib/mail/presets";
import { emailOf, htmlToText, stripQuoted, type ParsedMessage } from "@/lib/replies/gmail-thread";

/**
 * Mailboxes connected with an App Password: SMTP to send, IMAP to read the
 * replies to campaign emails. No Google API, so no restricted scopes.
 */

export type MailLogin = { user: string; pass: string };
export type MailServers = { smtp: ServerSettings; imap: ServerSettings | null; login: MailLogin };

export type SmtpSendResult =
  | { ok: true }
  | { ok: false; code: "auth" | "rate_limited" | "rejected" | "network"; message: string };

const TIMEOUT = 15_000;

function transport(s: ServerSettings, login: MailLogin) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    requireTLS: !s.secure,
    auth: { user: login.user, pass: login.pass },
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: 30_000,
  });
}

/** Turns SMTP errors into something a person can act on. Exported for tests. */
export function smtpProblem(e: unknown, host: string): { code: "auth" | "rate_limited" | "rejected" | "network"; message: string } {
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string };
  const text = `${err.response ?? ""} ${err.message ?? ""}`;
  const google = /gmail|google/i.test(host);
  if (err.code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534 || /authentication failed|username and password not accepted|invalid login|535/i.test(text))
    return {
      code: "auth",
      message: google
        ? "Google didn't accept the email address and App Password. Check that 2-Step Verification is on and you pasted a new 16-character App Password (not your normal password)."
        : "The mail server didn't accept the email address and password. Check them and try again.",
    };
  if (/daily user sending (quota|limit)|sending limit|quota exceeded|too many|rate limit|4\.7\.0 try again later|5\.4\.5/i.test(text) || err.responseCode === 421 || err.responseCode === 452)
    return { code: "rate_limited", message: "The mailbox's sending limit was reached for now. Sending continues later." };
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"].includes(err.code ?? "") || /timeout|getaddrinfo|connect/i.test(err.message ?? ""))
    return { code: "network", message: `Couldn't reach the mail server ${host}. Check the server name and port.` };
  return { code: "rejected", message: `The mail server refused the email${err.response ? `: ${err.response.slice(0, 160)}` : err.message ? `: ${err.message.slice(0, 160)}` : "."}` };
}

/** Logs in to the SMTP server without sending anything. */
export async function verifySmtp(s: ServerSettings, login: MailLogin): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const t = transport(s, login);
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, ...smtpProblem(e, s.host) };
  } finally {
    t.close();
  }
}

/** Sends a complete RFC 5322 message as is (our own Message-ID, Date and headers). */
export async function sendSmtp(s: ServerSettings, login: MailLogin, m: { from: string; to: string; raw: string }): Promise<SmtpSendResult> {
  const t = transport(s, login);
  try {
    await t.sendMail({ envelope: { from: m.from, to: [m.to] }, raw: m.raw });
    return { ok: true };
  } catch (e) {
    return { ok: false, ...smtpProblem(e, s.host) };
  } finally {
    t.close();
  }
}

function imapClient(s: ServerSettings, login: MailLogin) {
  return new ImapFlow({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: login.user, pass: login.pass },
    logger: false,
    connectionTimeout: TIMEOUT,
    greetingTimeout: TIMEOUT,
    socketTimeout: 60_000,
  });
}

/** IMAP errors in plain words. Exported for tests. */
export function imapProblem(e: unknown, host: string): { code: "auth" | "imap_off" | "network" | "error"; message: string } {
  const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string };
  const text = `${err.responseText ?? ""} ${err.message ?? ""}`;
  const google = /gmail|google/i.test(host);
  if (/not enabled for imap|imap access is disabled|imap is disabled/i.test(text))
    return { code: "imap_off", message: google ? "IMAP is turned off for this Gmail account. Turn it on in Gmail Settings → Forwarding and POP/IMAP, then try again." : "IMAP is turned off for this mailbox. Turn it on in your email settings." };
  if (err.authenticationFailed || /authenticationfailed|invalid credentials|login failed|authentication failed/i.test(text))
    return { code: "auth", message: google ? "Google didn't accept the App Password for reading replies (IMAP). Check that IMAP is on and the App Password is correct." : "The mail server didn't accept the password for IMAP." };
  if (["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EHOSTUNREACH"].includes(err.code ?? "") || /timeout|getaddrinfo/i.test(err.message ?? ""))
    return { code: "network", message: `Couldn't reach the IMAP server ${host}.` };
  return { code: "error", message: `IMAP error: ${(err.responseText || err.message || "unknown").slice(0, 160)}` };
}

/** Logs in to IMAP and opens the inbox, read-only. */
export async function verifyImap(s: ServerSettings, login: MailLogin): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const c = imapClient(s, login);
  try {
    await c.connect();
    const lock = await c.getMailboxLock("INBOX", { readOnly: true });
    lock.release();
    return { ok: true };
  } catch (e) {
    return { ok: false, ...imapProblem(e, s.host) };
  } finally {
    await c.logout().catch(() => c.close());
  }
}

export type FoundReply = ParsedMessage & { refs: string[] };

/** Every Message-ID mentioned in a header value like References or In-Reply-To. */
export function messageIds(v: string | string[] | undefined | null): string[] {
  const s = Array.isArray(v) ? v.join(" ") : (v ?? "");
  return [...s.matchAll(/<[^<>\s]+>/g)].map((m) => m[0].toLowerCase());
}

/**
 * Finds inbox messages since `since` that answer (or bounce) one of our sent
 * emails, identified by their Message-IDs. Read-only: nothing is marked read.
 */
export async function findReplies(s: ServerSettings, login: MailLogin, p: { since: Date; ours: Set<string>; self: string; max?: number }): Promise<{ ok: true; replies: FoundReply[] } | { ok: false; code: string; message: string }> {
  const c = imapClient(s, login);
  const replies: FoundReply[] = [];
  try {
    await c.connect();
    const lock = await c.getMailboxLock("INBOX", { readOnly: true });
    try {
      const uids = (await c.search({ since: p.since }, { uid: true })) || [];
      const recent = uids.slice(-(p.max ?? 300));
      if (!recent.length) return { ok: true, replies };
      // First pass: headers only, to pick the messages that point at one of ours (or look like bounces).
      const wanted: number[] = [];
      for await (const m of c.fetch(recent, { uid: true, envelope: true, headers: ["in-reply-to", "references"] }, { uid: true })) {
        const head = m.headers ? m.headers.toString("utf8") : "";
        const refs = messageIds(head);
        const from = (m.envelope?.from?.[0]?.address ?? "").toLowerCase();
        if (from === p.self) continue;
        if (refs.some((r) => p.ours.has(r)) || /mailer-daemon|postmaster|mail delivery/i.test(`${from} ${m.envelope?.from?.[0]?.name ?? ""}`)) wanted.push(m.uid);
      }
      for await (const m of wanted.length ? c.fetch(wanted, { uid: true, source: true }, { uid: true }) : []) {
        if (!m.source) continue;
        const raw = m.source.toString("utf8");
        const mail = await simpleParser(m.source);
        const headerRefs = [...messageIds(mail.inReplyTo), ...messageIds(mail.references as string | string[] | undefined)];
        // A bounce quotes the original message, so look for our Message-IDs anywhere in it.
        const refs = headerRefs.some((r) => p.ours.has(r)) ? headerRefs : messageIds(raw).filter((r) => p.ours.has(r));
        if (!refs.some((r) => p.ours.has(r))) continue;
        const from = mail.from?.text ?? "";
        const auto = String(mail.headers.get("auto-submitted") ?? "").toLowerCase();
        const text = mail.text ?? (typeof mail.html === "string" ? htmlToText(mail.html) : "");
        replies.push({
          id: (mail.messageId ?? `imap:${m.uid}`).toLowerCase().slice(0, 300),
          from,
          fromEmail: emailOf(from),
          to: Array.isArray(mail.to) ? mail.to.map((t) => t.text).join(", ") : (mail.to?.text ?? ""),
          subject: mail.subject ?? "",
          date: mail.date ?? new Date(),
          text: stripQuoted(text).slice(0, 8000),
          autoSubmitted: (!!auto && auto !== "no") || mail.headers.has("x-autoreply") || mail.headers.has("x-autorespond"),
          refs,
        });
      }
      return { ok: true, replies };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { ok: false, ...imapProblem(e, s.host) };
  } finally {
    await c.logout().catch(() => c.close());
  }
}
