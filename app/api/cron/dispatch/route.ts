import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDispatch } from "@/server/services/dispatch";

/**
 * Scheduler entry point: one sending pass across all workspaces. Call every
 * 5–10 minutes with "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends
 * this header automatically; a free external scheduler can send it too).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await runDispatch();
  return NextResponse.json({ sent: r.sent, failed: r.failed, skipped: r.skipped.length }, { headers: { "cache-control": "no-store" } });
}
