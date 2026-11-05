/**
 * Parsing Gmail API thread responses (users.threads.get, format=full).
 * Only plain text is kept: HTML bodies are reduced to text, never stored.
 */

type Header = { name?: string; value?: string };
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: Header[] };
export type GmailMessage = { id?: string; threadId?: string; internalDate?: string; snippet?: string; labelIds?: string[]; payload?: Part };

export type ParsedMessage = {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  date: Date;
  text: string;
  autoSubmitted: boolean;
};

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

export function header(p: Part | undefined, name: string) {
  return p?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function emailOf(from: string) {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

function findPart(p: Part | undefined, type: string): Part | null {
  if (!p) return null;
  if (p.mimeType === type && p.body?.data) return p;
  for (const c of p.parts ?? []) {
    const f = findPart(c, type);
    if (f) return f;
  }
  return null;
}

export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Drops quoted history ("On … wrote:" and "> " lines) so only the new reply remains. */
export function stripQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^On .{4,200}wrote:\s*$/i.test(l.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim()) || /^From: .+/i.test(l.trim()) && out.length > 0) break;
    if (l.trimStart().startsWith(">")) continue;
    out.push(l);
  }
  return out.join("\n").trim();
}

export function parseMessage(m: GmailMessage): ParsedMessage | null {
  if (!m.id || !m.payload) return null;
  const plain = findPart(m.payload, "text/plain");
  const html = plain ? null : findPart(m.payload, "text/html");
  const raw = plain ? b64(plain.body!.data!) : html ? htmlToText(b64(html.body!.data!)) : m.snippet ?? "";
  const from = header(m.payload, "From");
  const auto = header(m.payload, "Auto-Submitted").toLowerCase();
  return {
    id: m.id,
    from,
    fromEmail: emailOf(from),
    to: header(m.payload, "To"),
    subject: header(m.payload, "Subject"),
    date: new Date(Number(m.internalDate ?? Date.now())),
    text: stripQuoted(raw).slice(0, 8000),
    autoSubmitted: (!!auto && auto !== "no") || !!header(m.payload, "X-Autoreply") || !!header(m.payload, "X-Autorespond"),
  };
}
