import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeFromUpdates } from "@/server/services/announcements";

/** RFC 8058 one-click unsubscribe from product emails: mail apps POST here directly. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/updates/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const ok = await unsubscribeFromUpdates(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
