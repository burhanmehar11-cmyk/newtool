import { NextResponse, type NextRequest } from "next/server";
import type { Q } from "@/server/auth-store";
import { bumpVisit } from "@/server/attribution-store";
import { withService } from "@/server/db";

/**
 * Anonymous visit counter: adds one to today's total for a source. Stores no
 * IP, cookie or identifier. Ignores bots and anything malformed.
 */
export async function POST(request: NextRequest) {
  if (/bot|crawl|spider|headless|preview/i.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  const text = (await request.text().catch(() => "")).slice(0, 300);
  let source: unknown;
  try {
    source = (JSON.parse(text) as { source?: unknown }).source;
  } catch {
    source = null;
  }
  if (typeof source === "string" && /^[a-z0-9][a-z0-9.\-_]{0,79}$/.test(source)) {
    await withService((q) => bumpVisit(q as unknown as Q, source as string)).catch(() => undefined);
  }
  return new NextResponse(null, { status: 204 });
}
