import { connect as tlsConnect } from "node:tls";
import { connect as netConnect } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { adminApiActor } from "@/server/admin-api-auth";

/**
 * Private admin API (ADMIN_API_TOKEN): can this deployment reach mail servers?
 * Opens a connection to each, reads the server's greeting and hangs up. No
 * login, nothing sent.
 */
export const maxDuration = 30;

const TARGETS = [
  { name: "Gmail SMTP (SSL)", host: "smtp.gmail.com", port: 465, tls: true },
  { name: "Gmail SMTP (STARTTLS)", host: "smtp.gmail.com", port: 587, tls: false },
  { name: "Gmail IMAP (SSL)", host: "imap.gmail.com", port: 993, tls: true },
  { name: "Zoho SMTP (SSL)", host: "smtp.zoho.com", port: 465, tls: true },
  { name: "Zoho IMAP (SSL)", host: "imap.zoho.com", port: 993, tls: true },
];

function probe(t: (typeof TARGETS)[number]): Promise<{ name: string; ok: boolean; ms: number; greeting?: string; error?: string }> {
  const started = Date.now();
  return new Promise((resolve) => {
    const done = (r: { ok: boolean; greeting?: string; error?: string }) => {
      socket.destroy();
      resolve({ name: t.name, ms: Date.now() - started, ...r });
    };
    const socket = t.tls ? tlsConnect({ host: t.host, port: t.port, servername: t.host }) : netConnect({ host: t.host, port: t.port });
    socket.setTimeout(8_000, () => done({ ok: false, error: "timed out" }));
    socket.once("data", (d) => done({ ok: true, greeting: d.toString("utf8").split("\r\n")[0].slice(0, 80) }));
    socket.once("error", (e) => done({ ok: false, error: e.message.slice(0, 120) }));
  });
}

export async function GET(request: NextRequest) {
  if (!adminApiActor(request)) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  const results = await Promise.all(TARGETS.map(probe));
  return NextResponse.json({ ok: results.every((r) => r.ok), region: process.env.VERCEL_REGION ?? null, results }, { headers: { "cache-control": "no-store" } });
}
