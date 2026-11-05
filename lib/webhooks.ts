import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhooks: events, signatures and retry timing. A delivery is a POST of
 * JSON with these headers:
 *   Locenti-Event: reply.received
 *   Locenti-Delivery: <delivery id>
 *   Locenti-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret>
 */

export const WEBHOOK_EVENTS = ["lead.created", "email.sent", "reply.received", "campaign.completed"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const EVENT_INFO: Record<WebhookEvent, string> = {
  "lead.created": "A business is saved to Leads (from the app, the API or an agent).",
  "email.sent": "Gmail accepted a campaign email or follow-up.",
  "reply.received": "A reply to a campaign email arrived, with its suggested label.",
  "campaign.completed": "A campaign has nothing left to send.",
};

/** Waits before each retry: 1 min, 5 min, 30 min, 2 h, 6 h. After that the delivery is marked failed. */
export const RETRY_DELAYS_S = [60, 300, 1800, 7200, 21600];
export const MAX_ATTEMPTS = RETRY_DELAYS_S.length + 1;
/** Consecutive failed deliveries before an endpoint is switched off. */
export const DISABLE_AFTER = 30;

export function signatureHeader(secret: string, body: string, t: number = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** For receivers (and our tests): checks the signature and that it's at most `toleranceS` old. */
export function verifySignature(secret: string, body: string, header: string, nowS = Math.floor(Date.now() / 1000), toleranceS = 300): boolean {
  const m = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(header.trim());
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(nowS - t) > toleranceS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  const got = Buffer.from(m[2]);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function webhookUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return "Enter a full URL, like https://example.com/hooks/locenti.";
  }
  if (u.protocol !== "https:") return "Webhook URLs must start with https://.";
  if (u.username || u.password) return "Leave credentials out of the URL; check the signature instead.";
  if (raw.length > 500) return "That URL is too long.";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return "Use a public host name, not an IP address or local name.";
  return null;
}
