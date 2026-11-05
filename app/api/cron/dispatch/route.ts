import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDispatch } from "@/server/services/dispatch";
import { syncWorkspaceReplies } from "@/server/services/replies";
import { deliverDueWebhooks } from "@/server/services/webhooks";
import { withService } from "@/server/db";

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
  // Reply tracking for every workspace with it turned on (throttled per mailbox).
  const ws = await withService((q) => q.query<{ workspace_id: string }>("select distinct workspace_id from public.sending_accounts where status = 'connected' and scopes like '%gmail.readonly%'"));
  let replies = 0;
  for (const w of ws.rows) replies += (await syncWorkspaceReplies(w.workspace_id).catch(() => ({ newReplies: 0 }))).newReplies;
  const hooks = await deliverDueWebhooks({ limit: 50 });
  return NextResponse.json({ sent: r.sent, failed: r.failed, skipped: r.skipped.length, newReplies: replies, webhooks: hooks }, { headers: { "cache-control": "no-store" } });
}
