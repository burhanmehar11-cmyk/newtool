import { NextResponse, type NextRequest } from "next/server";
import { tokenRequest } from "@/server/services/oauth";

/** OAuth token endpoint: authorization_code (with PKCE) and refresh_token. Public clients, no secret. */

const headers = { "cache-control": "no-store", pragma: "no-cache", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization" };

async function form(request: NextRequest): Promise<Record<string, string | undefined>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
  }
  const text = await request.text().catch(() => "");
  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(request: NextRequest) {
  const r = await tokenRequest(await form(request));
  return NextResponse.json(r.body, { status: r.ok ? 200 : r.status, headers });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "POST, OPTIONS" } });
}
