/**
 * Builds a plain-text RFC 5322 message for the Gmail API's
 * users.messages.send ("raw" = base64url of the full message).
 */

export type OutgoingEmail = {
  from: { email: string; name?: string | null };
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
};

const EMAIL = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[a-z]{2,63}$/i;

export function isPlainEmail(v: string) {
  return EMAIL.test(v);
}

/** No CR/LF in header values: prevents header injection. */
function safe(v: string, field: string) {
  if (/[\r\n]/.test(v)) throw new Error(`Invalid ${field}`);
  return v;
}

/** RFC 2047 encoded-word for non-ASCII header text. */
export function encodeHeaderText(v: string) {
  safe(v, "header");
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function mailbox(email: string, name?: string | null) {
  if (!isPlainEmail(email)) throw new Error("Invalid email address");
  if (!name) return email;
  const n = safe(name, "name").trim();
  return /^[\x20-\x7e]*$/.test(n) ? `"${safe(n, "name").replace(/["\\]/g, "\\$&")}" <${email}>` : `${encodeHeaderText(n)} <${email}>`;
}

export function buildMessage(m: OutgoingEmail): string {
  const lines = [
    `From: ${mailbox(m.from.email, m.from.name)}`,
    `To: ${mailbox(m.to)}`,
    `Subject: ${encodeHeaderText(m.subject.trim())}`,
  ];
  if (m.replyTo) lines.push(`Reply-To: ${mailbox(m.replyTo)}`);
  for (const [k, v] of Object.entries(m.headers ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9-]{0,60}$/.test(k)) throw new Error("Invalid header name");
    lines.push(`${k}: ${safe(v, k)}`);
  }
  lines.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "");
  const body = Buffer.from(m.text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return `${lines.join("\r\n")}\r\n${body}`;
}

export function toGmailRaw(message: string) {
  return Buffer.from(message, "utf8").toString("base64url");
}
