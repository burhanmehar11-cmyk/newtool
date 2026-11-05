import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { handleMessage } from "@/lib/mcp/protocol";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { MCP_INSTRUCTIONS, mcpTools, type McpCtx } from "@/server/mcp/tools";
import { resolveToken } from "@/server/token-store";

/**
 * MCP endpoint (Streamable HTTP, stateless, JSON responses). Authenticate
 * with a personal access token from Settings → AI agents:
 *   Authorization: Bearer loc_…
 */

export const maxDuration = 60;

const unauthorized = () =>
  NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid access token. Create one in Locentio: Settings → AI agents." } }, { status: 401, headers: { "www-authenticate": 'Bearer realm="locentio"' } });

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(loc_[A-Za-z0-9_-]{20,100})$/)?.[1];
  if (!token) return unauthorized();
  const hash = createHash("sha256").update(token).digest("hex");
  const t = await withService((q) => resolveToken(q as unknown as Q, hash)).catch(() => null);
  if (!t) return unauthorized();
  const ctx: McpCtx = { user: { id: t.userId }, workspace: { id: t.workspaceId, name: t.workspaceName, role: t.role } };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.slice(0, 20).map((m) => handleMessage(m, mcpTools, ctx, MCP_INSTRUCTIONS)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const res = await handleMessage(body, mcpTools, ctx, MCP_INSTRUCTIONS);
  return res ? NextResponse.json(res, { headers: { "cache-control": "no-store" } }) : new NextResponse(null, { status: 202 });
}

/** No server-initiated stream: this server only answers requests. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
