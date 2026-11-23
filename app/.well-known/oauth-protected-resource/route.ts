import { NextResponse } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth";
import { oauthOrigin } from "@/server/services/oauth";

/** RFC 9728: tells AI apps which server signs people in for the MCP endpoint. */
export function GET() {
  return NextResponse.json(protectedResourceMetadata(oauthOrigin()), { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
}
