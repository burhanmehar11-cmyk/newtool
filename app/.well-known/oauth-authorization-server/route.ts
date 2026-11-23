import { NextResponse } from "next/server";
import { authorizationServerMetadata } from "@/lib/oauth";
import { oauthOrigin } from "@/server/services/oauth";

/** RFC 8414: Locenti's sign-in endpoints for AI apps. */
export function GET() {
  return NextResponse.json(authorizationServerMetadata(oauthOrigin()), { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
}
