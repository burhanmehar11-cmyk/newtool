import "server-only";
import { z } from "zod";
import { brand } from "@/config/brand";
import {
  ACCESS_TTL_S,
  CODE_TTL_S,
  OAUTH_SCOPE,
  REFRESH_TTL_S,
  acceptableRedirectUri,
  isMetadataDocumentClientId,
  newAccessToken,
  newClientId,
  newCode,
  newRefreshToken,
  pkceMatches,
  resourceAllowed,
  sha256,
} from "@/lib/oauth";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";
import { configuredSiteUrl } from "@/server/env";
import { track } from "@/server/events";
import { safeFetch } from "@/server/research/fetch";

/**
 * Locenti as an OAuth 2.1 authorization server for its own MCP endpoint, so
 * AI apps (ChatGPT, Claude, …) can connect with a sign-in instead of a pasted
 * token. Apps register themselves (dynamic client registration) or identify
 * with a client ID metadata document. Everything here uses the service
 * connection; codes and tokens are stored only as SHA-256 hashes.
 */

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
export const oauthOrigin = () => (configuredSiteUrl() ?? brand.siteUrl).replace(/\/$/, "");

export type OAuthClient = { client_id: string; client_name: string | null; redirect_uris: string[]; source: "dcr" | "cimd" };

/* -------------------------------------------------------------- clients */

const registration = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().trim().max(120).optional(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
});

/** RFC 7591 dynamic client registration: public clients only, https (or local) redirect URIs. */
export async function registerClient(input: unknown): Promise<{ ok: true; client: Record<string, unknown> } | { ok: false; error: string; description: string }> {
  const p = registration.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid_client_metadata", description: p.error.issues[0]?.message ?? "Invalid registration." };
  if (!p.data.redirect_uris.every(acceptableRedirectUri)) return { ok: false, error: "invalid_redirect_uri", description: "Redirect URIs must use https (or http on localhost)." };
  if (p.data.token_endpoint_auth_method && p.data.token_endpoint_auth_method !== "none") return { ok: false, error: "invalid_client_metadata", description: "Only public clients (token_endpoint_auth_method none) with PKCE are supported." };
  const clientId = newClientId();
  const name = p.data.client_name?.slice(0, 120) || null;
  await svc((q) => q.query("insert into app.oauth_clients (client_id, client_name, redirect_uris, source, metadata) values ($1, $2, $3, 'dcr', $4::jsonb)", [clientId, name, p.data.redirect_uris, JSON.stringify(p.data)]));
  return {
    ok: true,
    client: {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name ?? undefined,
      redirect_uris: p.data.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: OAUTH_SCOPE,
    },
  };
}

const cimd = z.object({ client_id: z.string(), client_name: z.string().max(120).optional(), redirect_uris: z.array(z.string()).min(1).max(20) });

/** A registered client, or one identified by its metadata document URL (fetched and cached for a day). */
export async function findClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 500) return null;
  const row = (await svc((q) => q.query<OAuthClient & { refreshed_at: string }>("select client_id, client_name, redirect_uris, source, refreshed_at from app.oauth_clients where client_id = $1", [clientId]))).rows[0];
  if (row && (row.source === "dcr" || Date.now() - new Date(row.refreshed_at).getTime() < 24 * 3600_000)) return row;
  if (!isMetadataDocumentClientId(clientId)) return row ?? null;
  const r = await safeFetch(clientId, { userAgent: "Locenti-OAuth/1.0", deadline: Date.now() + 5000, maxBytes: 64 * 1024, accept: "application/json", allowTypes: /json/ });
  if (!r.ok) return row ?? null;
  let doc: z.infer<typeof cimd>;
  try {
    const parsed = cimd.safeParse(JSON.parse(r.body));
    if (!parsed.success) return null;
    doc = parsed.data;
  } catch {
    return null;
  }
  if (doc.client_id !== clientId) return null;
  const uris = doc.redirect_uris.filter(acceptableRedirectUri);
  if (!uris.length) return null;
  await svc((q) =>
    q.query(
      `insert into app.oauth_clients (client_id, client_name, redirect_uris, source, metadata) values ($1, $2, $3, 'cimd', $4::jsonb)
       on conflict (client_id) do update set client_name = excluded.client_name, redirect_uris = excluded.redirect_uris, metadata = excluded.metadata, refreshed_at = now()`,
      [clientId, doc.client_name ?? null, uris, JSON.stringify(doc)],
    ),
  );
  return { client_id: clientId, client_name: doc.client_name ?? null, redirect_uris: uris, source: "cimd" };
}

/** A friendly name for the consent screen: the app's own name, or its website. */
export function clientLabel(c: OAuthClient) {
  if (c.client_name) return c.client_name;
  try {
    return new URL(c.redirect_uris[0]).hostname;
  } catch {
    return "An AI app";
  }
}

/* ------------------------------------------------------- authorization */

export const authorizeParams = z.object({
  response_type: z.literal("code", { message: "unsupported_response_type" }),
  client_id: z.string().min(8).max(500),
  redirect_uri: z.string().max(500),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "invalid code_challenge"),
  code_challenge_method: z.literal("S256", { message: "code_challenge_method must be S256" }),
  state: z.string().max(1000).optional(),
  scope: z.string().max(500).optional(),
  resource: z.string().max(500).optional(),
});
export type AuthorizeParams = z.infer<typeof authorizeParams>;

/** Issues a one-time code after the person approved, for one of their workspaces. */
export async function issueCode(p: AuthorizeParams, userId: string, workspaceId: string): Promise<string> {
  const code = newCode();
  await svc((q) =>
    q.query(
      `insert into app.oauth_codes (code_hash, client_id, user_id, workspace_id, redirect_uri, code_challenge, scope, resource, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(secs => $9))`,
      [sha256(code), p.client_id, userId, workspaceId, p.redirect_uri, p.code_challenge, OAUTH_SCOPE, p.resource ?? null, CODE_TTL_S],
    ),
  );
  return code;
}

/* ---------------------------------------------------------------- tokens */

type TokenResponse = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string };
type TokenError = { error: "invalid_request" | "invalid_grant" | "invalid_client" | "unsupported_grant_type" | "invalid_target"; error_description: string };

async function newTokens(q: Q, grantId: string): Promise<TokenResponse> {
  const access = newAccessToken();
  const refresh = newRefreshToken();
  await q.query(
    `update app.oauth_grants set access_hash = $2, access_expires_at = now() + make_interval(secs => $4),
       refresh_hash = $3, refresh_expires_at = now() + make_interval(secs => $5) where id = $1`,
    [grantId, sha256(access), sha256(refresh), ACCESS_TTL_S, REFRESH_TTL_S],
  );
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: OAUTH_SCOPE };
}

/** The token endpoint: exchanges a code (with its PKCE verifier) or rotates a refresh token. */
export async function tokenRequest(form: Record<string, string | undefined>): Promise<{ ok: true; body: TokenResponse } | { ok: false; status: number; body: TokenError }> {
  const bad = (error: TokenError["error"], error_description: string, status = 400) => ({ ok: false as const, status, body: { error, error_description } });
  const origin = oauthOrigin();
  if (form.resource && !resourceAllowed(form.resource, origin)) return bad("invalid_target", "Unknown resource.");

  if (form.grant_type === "authorization_code") {
    if (!form.code || !form.code_verifier || !form.client_id || !form.redirect_uri) return bad("invalid_request", "code, code_verifier, client_id and redirect_uri are required.");
    return svc(async (q) => {
      // Single use: the code is marked used in the same statement that reads it.
      const c = (
        await q.query<{ client_id: string; user_id: string; workspace_id: string; redirect_uri: string; code_challenge: string; scope: string }>(
          `update app.oauth_codes set used_at = now() where code_hash = $1 and used_at is null and expires_at > now()
           returning client_id, user_id, workspace_id, redirect_uri, code_challenge, scope`,
          [sha256(form.code!)],
        )
      ).rows[0];
      if (!c) return bad("invalid_grant", "The code is invalid, expired or already used.");
      if (c.client_id !== form.client_id || c.redirect_uri !== form.redirect_uri) return bad("invalid_grant", "The code was issued to a different client or redirect URI.");
      if (!pkceMatches(form.code_verifier!, c.code_challenge)) return bad("invalid_grant", "PKCE verification failed.");
      const member = (await q.query("select 1 from public.memberships where workspace_id = $1 and user_id = $2", [c.workspace_id, c.user_id])).rows.length > 0;
      if (!member) return bad("invalid_grant", "The person no longer belongs to that workspace.");
      const grant = (await q.query<{ id: string }>("insert into app.oauth_grants (client_id, user_id, workspace_id, scope) values ($1, $2, $3, $4) returning id", [c.client_id, c.user_id, c.workspace_id, c.scope])).rows[0].id;
      return { ok: true as const, body: await newTokens(q, grant) };
    });
  }

  if (form.grant_type === "refresh_token") {
    if (!form.refresh_token) return bad("invalid_request", "refresh_token is required.");
    return svc(async (q) => {
      const g = (
        await q.query<{ id: string; client_id: string; user_id: string; workspace_id: string }>(
          `select g.id, g.client_id, g.user_id, g.workspace_id from app.oauth_grants g
           join public.memberships m on m.workspace_id = g.workspace_id and m.user_id = g.user_id
           where g.refresh_hash = $1 and g.revoked_at is null and g.refresh_expires_at > now()`,
          [sha256(form.refresh_token!)],
        )
      ).rows[0];
      if (!g) return bad("invalid_grant", "The refresh token is invalid, expired or revoked.");
      if (form.client_id && form.client_id !== g.client_id) return bad("invalid_grant", "The refresh token belongs to a different client.");
      return { ok: true as const, body: await newTokens(q, g.id) };
    });
  }
  return bad("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

/** The MCP endpoint's check: a live access token → who it acts for, in which workspace, with their current role. */
export async function resolveAccessToken(token: string): Promise<{ grantId: string; userId: string; workspaceId: string; workspaceName: string; role: string } | null> {
  return svc(async (q) => {
    const g = (
      await q.query<{ id: string; user_id: string; workspace_id: string; name: string; role: string }>(
        `select g.id, g.user_id, g.workspace_id, w.name, m.role from app.oauth_grants g
         join public.memberships m on m.workspace_id = g.workspace_id and m.user_id = g.user_id
         join public.workspaces w on w.id = g.workspace_id
         where g.access_hash = $1 and g.revoked_at is null and g.access_expires_at > now()`,
        [sha256(token)],
      )
    ).rows[0];
    if (!g) return null;
    await q.query("update app.oauth_grants set last_used_at = now() where id = $1 and (last_used_at is null or last_used_at < now() - interval '1 minute')", [g.id]);
    return { grantId: g.id, userId: g.user_id, workspaceId: g.workspace_id, workspaceName: g.name, role: g.role };
  });
}

/** RFC 7009: revoking either token ends the whole connection. Always "ok", as the spec asks. */
export async function revokeByToken(token: string) {
  if (!token) return;
  const h = sha256(token);
  await svc((q) => q.query("update app.oauth_grants set revoked_at = now() where (access_hash = $1 or refresh_hash = $1) and revoked_at is null", [h]));
}

/* ------------------------------------------------- the person's own view */

export type ConnectedApp = { id: string; name: string; created_at: string; last_used_at: string | null };

/** Apps connected to this workspace by this person (Agent page). */
export async function connectedApps(userId: string, workspaceId: string): Promise<ConnectedApp[]> {
  try {
    const r = await svc((q) =>
      q.query<ConnectedApp & { client_name: string | null; redirect_uris: string[] }>(
        `select g.id, c.client_name, c.redirect_uris, g.created_at, g.last_used_at from app.oauth_grants g join app.oauth_clients c on c.client_id = g.client_id
         where g.user_id = $1 and g.workspace_id = $2 and g.revoked_at is null and g.refresh_expires_at > now() order by g.created_at desc`,
        [userId, workspaceId],
      ),
    );
    return r.rows.map((g) => ({ id: g.id, name: clientLabel({ client_id: "", client_name: g.client_name, redirect_uris: g.redirect_uris, source: "dcr" }), created_at: g.created_at, last_used_at: g.last_used_at }));
  } catch {
    return []; // before the database update 0023 runs
  }
}

export async function disconnectApp(userId: string, workspaceId: string, grantId: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(grantId).success) return false;
  const ok = (await svc((q) => q.query("update app.oauth_grants set revoked_at = now() where id = $1 and user_id = $2 and workspace_id = $3 and revoked_at is null returning id", [grantId, userId, workspaceId]))).rows.length > 0;
  if (ok) await track({ workspaceId, userId, kind: "oauth_app_disconnected", area: "agents", outcome: "info", summary: "Disconnected an AI app" });
  return ok;
}

export async function recordConnected(userId: string, workspaceId: string, appName: string) {
  await track({ workspaceId, userId, kind: "oauth_app_connected", area: "agents", outcome: "success", summary: `Connected ${appName} to the workspace` });
}
