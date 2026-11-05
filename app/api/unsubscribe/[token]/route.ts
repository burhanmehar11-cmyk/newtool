import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/server/services/unsubscribe";

/** RFC 8058 one-click unsubscribe: mail apps POST here directly. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  const ok = await unsubscribeByToken(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
