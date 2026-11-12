/**
 * Builds a plain-text RFC 5322 message for the Gmail API's
 * users.messages.send ("raw" = base64url of the full message).
 */

export type OutgoingEmail = {
  from: { email: string; name?: string | null };
  to: string;
  subject: string;
  text: string;
  /** Optional HTML version; the text stays as the fallback (multipart/alternative). */
  html?: string | null;
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
  // SMTP sends the message exactly as built, so it needs its own Date (the Gmail API used to add one).
  if (!Object.keys(m.headers ?? {}).some((k) => k.toLowerCase() === "date")) lines.push(`Date: ${new Date().toUTCString()}`);
  for (const [k, v] of Object.entries(m.headers ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9-]{0,60}$/.test(k)) throw new Error("Invalid header name");
    lines.push(`${k}: ${safe(v, k)}`);
  }
  const b64 = (s: string) => Buffer.from(s.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  if (!m.html) {
    lines.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "");
    return `${lines.join("\r\n")}\r\n${b64(m.text)}`;
  }
  const boundary = `locenti-${Buffer.from(m.subject + m.to).toString("hex").slice(0, 16)}-${Date.now().toString(36)}`;
  lines.push("MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`, "");
  const part = (type: string, content: string) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", b64(content)].join("\r\n");
  return `${lines.join("\r\n")}\r\n${part("text/plain", m.text)}\r\n${part("text/html", m.html)}\r\n--${boundary}--\r\n`;
}

export function toGmailRaw(message: string) {
  return Buffer.from(message, "utf8").toString("base64url");
}
