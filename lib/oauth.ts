import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * OAuth 2.1 for AI apps connecting to Locenti's MCP server (ChatGPT, Claude
 * and other MCP clients): authorization code + PKCE (S256), public clients,
 * one scope. Pure helpers, shared by the routes and the tests.
 */

export const OAUTH_SCOPE = "locenti";
export const ACCESS_TTL_S = 3600;
export const REFRESH_TTL_S = 60 * 24 * 3600;
export const CODE_TTL_S = 600;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const random = (bytes: number) => randomBytes(bytes).toString("base64url");

export const newClientId = () => `lcid_${random(18)}`;
export const newCode = () => `lcc_${random(32)}`;
export const newAccessToken = () => `lca_${random(32)}`;
export const newRefreshToken = () => `lcr_${random(40)}`;

/** True for tokens this server issues to apps (as opposed to personal access tokens, "loc_"). */
export function isOAuthAccessToken(v: string) {
  return /^lca_[A-Za-z0-9_-]{40,60}$/.test(v);
}

/** PKCE S256: BASE64URL(SHA256(verifier)) must equal the challenge. */
export function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return false;
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Redirect URIs an app may register: https anywhere, or http on this
 * computer (desktop and developer tools). No fragments, no credentials.
 */
export function acceptableRedirectUri(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 500) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

/** A client ID that is itself the URL of the app's metadata document (CIMD). */
export function isMetadataDocumentClientId(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.pathname.length > 1 && !u.hash && !u.username;
  } catch {
    return false;
  }
}

/** The resource (audience) a token may be used for: the MCP endpoint, or the site itself. */
export function resourceAllowed(resource: string | null | undefined, origin: string) {
  if (!resource) return true;
  const r = resource.replace(/\/$/, "");
  return r === `${origin}/api/mcp` || r === origin;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Locenti",
    resource_documentation: `${origin}/app/agent`,
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/app/agent`,
  };
}

/** Where the person is sent back to, with the result in the query string. */
export function redirectWith(redirectUri: string, params: Record<string, string | null | undefined>) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}
