import { NextResponse, type NextRequest } from "next/server";
import { handlePaddleWebhook } from "@/server/services/billing";

/** Paddle webhook endpoint. Set its URL in Paddle → Developer tools → Notifications: https://<your domain>/api/billing/paddle */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 512_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const r = await handlePaddleWebhook(raw, request.headers.get("paddle-signature"));
  return NextResponse.json({ note: r.note }, { status: r.status, headers: { "cache-control": "no-store" } });
}
