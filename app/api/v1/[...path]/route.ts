import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { ToolError } from "@/lib/mcp/protocol";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { mcpTools, type McpCtx } from "@/server/mcp/tools";
import { resolveToken } from "@/server/token-store";

/**
 * Public REST API (v1). Same personal tokens and the same rules as the MCP
 * server: each call runs as the token's owner in their workspace, with
 * row-level security. Nothing here can approve or send a campaign.
 *
 *   Authorization: Bearer loc_…
 */

export const maxDuration = 60;

type Route = { method: "GET" | "POST"; pattern: RegExp; tool: string; args: (m: RegExpMatchArray, query: URLSearchParams, body: Record<string, unknown>) => Record<string, unknown> };

const ID = "([0-9a-f-]{36})";
const int = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const ROUTES: Route[] = [
  { method: "GET", pattern: /^workspace$/, tool: "get_workspace", args: () => ({}) },
  { method: "POST", pattern: /^search$/, tool: "search_google_maps", args: (_m, _q, b) => b },
  { method: "GET", pattern: /^leads$/, tool: "list_leads", args: (_m, q) => clean({ limit: int(q.get("limit")) }) },
  { method: "POST", pattern: /^leads$/, tool: "save_google_leads", args: (_m, _q, b) => b },
  { method: "GET", pattern: new RegExp(`^leads/${ID}$`), tool: "get_lead", args: (m) => ({ lead_id: m[1] }) },
  { method: "POST", pattern: new RegExp(`^leads/${ID}/research$`), tool: "research_lead", args: (m) => ({ lead_id: m[1] }) },
  { method: "POST", pattern: new RegExp(`^leads/${ID}/drafts$`), tool: "save_draft", args: (m, _q, b) => ({ ...b, lead_id: m[1] }) },
  { method: "GET", pattern: /^campaigns$/, tool: "list_campaigns", args: () => ({}) },
  { method: "POST", pattern: /^campaigns$/, tool: "create_campaign_draft", args: (_m, _q, b) => b },
  { method: "GET", pattern: new RegExp(`^campaigns/${ID}$`), tool: "get_campaign", args: (m) => ({ campaign_id: m[1] }) },
  { method: "GET", pattern: /^replies$/, tool: "list_replies", args: (_m, q) => clean({ label: q.get("label") ?? undefined, limit: int(q.get("limit")) }) },
];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status, status === 401 ? { "www-authenticate": 'Bearer realm="locenti"' } : {});

async function handle(request: NextRequest, method: "GET" | "POST", params: Promise<{ path: string[] }>) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(loc_[A-Za-z0-9_-]{20,100})$/)?.[1];
  if (!token) return fail(401, "unauthorized", "Send a personal access token: Authorization: Bearer loc_… (create one in Locenti → Agent).");
  const t = await withService((q) => resolveToken(q as unknown as Q, createHash("sha256").update(token).digest("hex"))).catch(() => null);
  if (!t) return fail(401, "unauthorized", "This token is invalid, revoked, or its owner left the workspace.");
  const ctx: McpCtx = { user: { id: t.userId }, workspace: { id: t.workspaceId, name: t.workspaceName, role: t.role } };

  const path = (await params).path.join("/").replace(/\/+$/, "");
  const candidates = ROUTES.filter((r) => r.pattern.test(path));
  if (!candidates.length) return fail(404, "not_found", `No endpoint at /api/v1/${path}.`);
  const route = candidates.find((r) => r.method === method);
  if (!route) return fail(405, "method_not_allowed", `Use ${candidates.map((r) => r.method).join(" or ")} for /api/v1/${path}.`);

  let body: Record<string, unknown> = {};
  if (method === "POST") {
    const text = await request.text();
    if (text.length > 64_000) return fail(413, "too_large", "Request bodies are limited to 64 KB.");
    if (text.trim()) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "invalid_json", "Send a JSON object.");
        body = parsed as Record<string, unknown>;
      } catch {
        return fail(400, "invalid_json", "The request body isn't valid JSON.");
      }
    }
  }
  const tool = mcpTools.find((x) => x.name === route.tool)!;
  try {
    return json(await tool.run(route.args(path.match(route.pattern)!, request.nextUrl.searchParams, body), ctx));
  } catch (e) {
    if (e instanceof ToolError) {
      const msg = e.message;
      const status = /not found/i.test(msg) ? 404 : /only workspace owners|not allowed|permission/i.test(msg) ? 403 : /limit|too many/i.test(msg) ? 429 : 400;
      return fail(status, status === 404 ? "not_found" : status === 403 ? "forbidden" : status === 429 ? "rate_limited" : "invalid_request", msg);
    }
    return fail(500, "server_error", "Something went wrong on our side. Try again.");
  }
}

export function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, "GET", ctx.params);
}
export function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, "POST", ctx.params);
}
