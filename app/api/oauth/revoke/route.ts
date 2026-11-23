import { NextResponse, type NextRequest } from "next/server";
import { revokeByToken } from "@/server/services/oauth";

/** RFC 7009 token revocation: ends the app's connection. Always 200. */
export async function POST(request: NextRequest) {
  const text = await request.text().catch(() => "");
  const token = new URLSearchParams(text).get("token") ?? "";
  await revokeByToken(token.slice(0, 200));
  return new NextResponse(null, { status: 200, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}
