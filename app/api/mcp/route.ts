import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { handleMessage } from "@/lib/mcp/protocol";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { MCP_INSTRUCTIONS, mcpTools, type McpCtx } from "@/server/mcp/tools";
import { MCP_RESOURCES } from "@/server/mcp/widgets";
import { resolveToken } from "@/server/token-store";
import { isOAuthAccessToken } from "@/lib/oauth";
import { oauthOrigin, resolveAccessToken } from "@/server/services/oauth";

/**
 * MCP endpoint (Streamable HTTP, stateless, JSON responses). Two ways in:
 *   - AI apps (ChatGPT, Claude, …) sign the person in with OAuth 2.1; the
 *     401 below points them to /.well-known/oauth-protected-resource.
 *   - Personal access tokens from the Agent page: Authorization: Bearer loc_…
 */

export const maxDuration = 60;

const unauthorized = (invalid: boolean) =>
  NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Sign in to Locenti to connect, or use a personal access token from the Agent page." } },
    {
      status: 401,
      headers: {
        "www-authenticate": `Bearer realm="locenti", resource_metadata="${oauthOrigin()}/.well-known/oauth-protected-resource", scope="locenti"${invalid ? ', error="invalid_token"' : ""}`,
        "access-control-expose-headers": "www-authenticate",
      },
    },
  );

async function contextFor(token: string): Promise<McpCtx | null> {
  if (isOAuthAccessToken(token)) {
    const g = await resolveAccessToken(token).catch(() => null);
    return g ? { user: { id: g.userId }, workspace: { id: g.workspaceId, name: g.workspaceName, role: g.role } } : null;
  }
  if (!/^loc_[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const t = await withService((q) => resolveToken(q as unknown as Q, hash)).catch(() => null);
  return t ? { user: { id: t.userId }, workspace: { id: t.workspaceId, name: t.workspaceName, role: t.role } } : null;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S{20,120})$/)?.[1];
  if (!token) return unauthorized(false);
  const ctx = await contextFor(token);
  if (!ctx) return unauthorized(true);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.slice(0, 20).map((m) => handleMessage(m, mcpTools, ctx, MCP_INSTRUCTIONS, MCP_RESOURCES)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const res = await handleMessage(body, mcpTools, ctx, MCP_INSTRUCTIONS, MCP_RESOURCES);
  return res ? NextResponse.json(res, { headers: { "cache-control": "no-store" } }) : new NextResponse(null, { status: 202 });
}

/** No server-initiated stream: this server only answers requests. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
