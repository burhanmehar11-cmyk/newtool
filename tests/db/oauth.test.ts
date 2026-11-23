import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { as, createTestDb, createUser } from "./harness";

/**
 * OAuth sign-in for AI apps (ChatGPT, Claude, …) against the real schema:
 * registration, the one-time code with PKCE, access and refresh tokens,
 * revocation, and the MCP endpoint accepting the token.
 */

const A = "00000000-0000-4000-8000-0000000000d1";
const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.test";
  return { db: null as unknown as PGlite, fetch: vi.fn() };
});
vi.mock("@/server/db", async () => {
  const { as } = await import("./harness");
  return { withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db), withUser: (u: string, fn: (q: unknown) => Promise<unknown>) => as(h.db, u, () => fn(h.db)) };
});
vi.mock("@/server/research/fetch", () => ({ safeFetch: (...a: unknown[]) => h.fetch(...a) }));
vi.mock("@/server/events", () => ({ track: vi.fn(), notifyWorkspace: vi.fn() }));

const oauth = await import("@/server/services/oauth");
const lib = await import("@/lib/oauth");
const mcp = await import("@/app/api/mcp/route");

let db: PGlite;
let ws = "";
const REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";
const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};
const params = (clientId: string, challenge: string) =>
  oauth.authorizeParams.parse({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "xyz", resource: "https://locenti.test/api/mcp" });

async function newClient() {
  const r = await oauth.registerClient({ client_name: "ChatGPT", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" });
  if (!r.ok) throw new Error(r.description);
  return r.client.client_id as string;
}
async function connect() {
  const clientId = await newClient();
  const { verifier, challenge } = pkce();
  const code = await oauth.issueCode(params(clientId, challenge), A, ws);
  const t = await oauth.tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
  if (!t.ok) throw new Error(t.body.error);
  return { clientId, ...t.body };
}
const mcpCall = (token: string | null, body: unknown) =>
  mcp.POST(new NextRequest("https://locenti.test/api/mcp", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));

beforeAll(async () => {
  db = await createTestDb();
  h.db = db;
  await createUser(db, A, "a@agency.example");
  ws = await as(db, A, async () => (await db.query<{ id: string }>("select public.create_workspace('Agency O') as id")).rows[0].id);
}, 60_000);

beforeEach(() => h.fetch.mockReset());

describe("registering an app", () => {
  it("accepts public clients with https (or local) redirect URIs, nothing else", async () => {
    const ok = await oauth.registerClient({ client_name: "ChatGPT", redirect_uris: [REDIRECT] });
    expect(ok).toMatchObject({ ok: true, client: { client_id: expect.stringMatching(/^lcid_/), token_endpoint_auth_method: "none", redirect_uris: [REDIRECT] } });
    expect(await oauth.registerClient({ redirect_uris: ["http://evil.example/cb"] })).toMatchObject({ ok: false, error: "invalid_redirect_uri" });
    expect(await oauth.registerClient({ redirect_uris: ["http://localhost:6274/callback"] })).toMatchObject({ ok: true });
    expect(await oauth.registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" })).toMatchObject({ ok: false });
  });

  it("looks up an app by its client ID metadata document, and checks it names itself", async () => {
    const id = "https://claude.ai/oauth/mcp-oauth-client-metadata";
    h.fetch.mockResolvedValue({ ok: true, url: id, status: 200, contentType: "application/json", body: JSON.stringify({ client_id: id, client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] }) });
    expect(await oauth.findClient(id)).toMatchObject({ client_id: id, client_name: "Claude", source: "cimd" });
    const other = "https://evil.example/metadata.json";
    h.fetch.mockResolvedValue({ ok: true, url: other, status: 200, contentType: "application/json", body: JSON.stringify({ client_id: "https://someone-else.example/x", redirect_uris: ["https://evil.example/cb"] }) });
    expect(await oauth.findClient(other)).toBeNull();
  });
});

describe("signing in and tokens", () => {
  it("exchanges a code once, only with the right PKCE verifier, client and redirect URI", async () => {
    const clientId = await newClient();
    const { verifier, challenge } = pkce();
    const code = await oauth.issueCode(params(clientId, challenge), A, ws);
    expect(await oauth.tokenRequest({ grant_type: "authorization_code", code, code_verifier: pkce().verifier, client_id: clientId, redirect_uri: REDIRECT })).toMatchObject({ ok: false, body: { error: "invalid_grant" } });
    // The failed try used the code up: a stolen code can't be retried either.
    expect(await oauth.tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT })).toMatchObject({ ok: false, body: { error: "invalid_grant" } });

    const code2 = await oauth.issueCode(params(clientId, challenge), A, ws);
    expect(await oauth.tokenRequest({ grant_type: "authorization_code", code: code2, code_verifier: verifier, client_id: clientId, redirect_uri: "https://other.example/cb" })).toMatchObject({ ok: false, body: { error: "invalid_grant" } });
    const code3 = await oauth.issueCode(params(clientId, challenge), A, ws);
    const t = await oauth.tokenRequest({ grant_type: "authorization_code", code: code3, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT });
    expect(t).toMatchObject({ ok: true, body: { token_type: "Bearer", expires_in: 3600, scope: "locenti", access_token: expect.stringMatching(/^lca_/), refresh_token: expect.stringMatching(/^lcr_/) } });
    const stored = (await db.query<{ access_hash: string }>("select access_hash from app.oauth_grants where client_id = $1", [clientId])).rows[0];
    expect(stored.access_hash).not.toContain("lca_"); // only hashes are kept
  });

  it("rotates refresh tokens, and revoking ends the connection", async () => {
    const c = await connect();
    expect(await oauth.resolveAccessToken(c.access_token)).toMatchObject({ userId: A, workspaceId: ws, workspaceName: "Agency O", role: "owner" });
    const r = await oauth.tokenRequest({ grant_type: "refresh_token", refresh_token: c.refresh_token, client_id: c.clientId });
    expect(r.ok).toBe(true);
    expect(await oauth.resolveAccessToken(c.access_token)).toBeNull(); // the old access token was replaced
    expect(await oauth.tokenRequest({ grant_type: "refresh_token", refresh_token: c.refresh_token })).toMatchObject({ ok: false, body: { error: "invalid_grant" } });
    const fresh = r.ok ? r.body : null;
    await oauth.revokeByToken(fresh!.refresh_token);
    expect(await oauth.resolveAccessToken(fresh!.access_token)).toBeNull();
  });

  it("stops working when the access token expires, and rejects unknown grants and resources", async () => {
    const c = await connect();
    await db.query("update app.oauth_grants set access_expires_at = now() - interval '1 second' where client_id = $1", [c.clientId]);
    expect(await oauth.resolveAccessToken(c.access_token)).toBeNull();
    expect(await oauth.tokenRequest({ grant_type: "unknown" })).toMatchObject({ ok: false, body: { error: "unsupported_grant_type" } });
    expect(await oauth.tokenRequest({ grant_type: "refresh_token", refresh_token: c.refresh_token, resource: "https://evil.example" })).toMatchObject({ ok: false, body: { error: "invalid_target" } });
  });

  it("lists and disconnects the person's connected apps", async () => {
    const c = await connect();
    const apps = await oauth.connectedApps(A, ws);
    const mine = apps[0]; // newest first: the connection just made
    expect(mine).toBeTruthy();
    expect(await oauth.disconnectApp(A, ws, mine!.id)).toBe(true);
    expect((await oauth.connectedApps(A, ws)).some((a) => a.id === mine!.id)).toBe(false);
    expect(mine.name).toBe("ChatGPT");
    expect(await oauth.resolveAccessToken(c.access_token)).toBeNull(); // cut off right away
  });
});

describe("the MCP endpoint", () => {
  it("points apps without a token to the sign-in, and serves those with one", async () => {
    const none = await mcpCall(null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe('Bearer realm="locenti", resource_metadata="https://locenti.test/.well-known/oauth-protected-resource", scope="locenti"');
    const bad = await mcpCall("lca_" + "x".repeat(43), { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(bad.status).toBe(401);
    expect(bad.headers.get("www-authenticate")).toContain('error="invalid_token"');

    const c = await connect();
    const list = await mcpCall(c.access_token, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(list.status).toBe(200);
    const tools = ((await list.json()) as { result: { tools: { name: string; annotations: Record<string, boolean> }[] } }).result.tools;
    expect(tools.length).toBe(11);
    for (const t of tools) expect(Object.keys(t.annotations)).toEqual(expect.arrayContaining(["readOnlyHint", "destructiveHint", "openWorldHint"]));
  });

  it("publishes the discovery documents apps read first", () => {
    expect(lib.protectedResourceMetadata("https://locenti.test")).toMatchObject({ resource: "https://locenti.test/api/mcp", authorization_servers: ["https://locenti.test"] });
    expect(lib.authorizationServerMetadata("https://locenti.test")).toMatchObject({
      issuer: "https://locenti.test",
      authorization_endpoint: "https://locenti.test/oauth/authorize",
      token_endpoint: "https://locenti.test/api/oauth/token",
      registration_endpoint: "https://locenti.test/api/oauth/register",
      code_challenge_methods_supported: ["S256"],
      client_id_metadata_document_supported: true,
    });
  });
});
