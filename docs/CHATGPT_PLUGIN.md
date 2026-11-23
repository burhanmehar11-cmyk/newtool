# Locenti in ChatGPT (and Claude)

Locenti's MCP server (`https://locenti.com/api/mcp`) works as a ChatGPT plugin (formerly "ChatGPT app") and as a Claude connector. People connect by signing in to Locenti (OAuth 2.1), not by pasting a token.

## What's built

| Piece | Where |
|---|---|
| MCP server (Streamable HTTP, 11 tools, explicit read-only / destructive / open-world labels) | `app/api/mcp/route.ts`, `server/mcp/tools.ts` |
| "Sign in" discovery: protected resource metadata | `/.well-known/oauth-protected-resource` (also `/…/api/mcp`) |
| Authorization server metadata | `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration` |
| App registration: dynamic client registration and client ID metadata documents | `POST /api/oauth/register`, `server/services/oauth.ts` |
| Consent screen (sign in, pick workspace, Allow / Cancel) | `/oauth/authorize` |
| Tokens: authorization code + PKCE (S256), 1-hour access tokens, rotating 60-day refresh tokens, revocation | `/api/oauth/token`, `/api/oauth/revoke` |
| Connected apps list with Disconnect | Agent page |
| ChatGPT domain verification | `/.well-known/openai-apps-challenge` (reads `OPENAI_APPS_CHALLENGE`) |
| Database | migration `0023_oauth.sql` (only hashes of codes and tokens are stored) |

| **Plugin package** (manifest, MCP config, skill, icons) | `plugin/`, build the upload zip with `npm run plugin:pack` → `dist/locenti-plugin.zip` |
| **Visual cards in the chat** (search results, lead research) | `server/mcp/widgets.ts` (MCP Apps `ui://` resources, also linked with ChatGPT's `openai/outputTemplate`) |

Apps can find, research and write drafts and draft campaigns. They can't send email: a person approves every campaign in Locenti.

## Before anything: run the migration

Neon → SQL Editor → run `database/migrations/0023_oauth.sql`.

## Test it in ChatGPT (developer mode, no review needed)

1. ChatGPT → **Settings → Apps** (may be called Connectors) → **Advanced settings** → turn on **Developer mode**.
2. **Create app** (or Add) → Name `Locenti`, MCP server URL `https://locenti.com/api/mcp`, Authentication **OAuth** → Create.
3. A Locenti window opens: sign in, pick the workspace, press **Allow**.
4. In a new chat, choose Locenti from the tools menu and try: "Find 10 dentists in Austin with emails and save them as leads."

Claude: **Settings → Connectors → Add custom connector** → `https://locenti.com/api/mcp` → Connect → sign in → Allow.

## The plugin package

`plugin/` follows OpenAI's Agent Plugins format:
- `plugin.json`: name, version, description, author, and under `extensions.com.openai.interface` the display name, short and long description, category, links (website, privacy, terms), example prompts, brand colour, icon and logo.
- `mcp.json`: the Locenti MCP server (`https://locenti.com/api/mcp`).
- `skills/locenti-prospecting/SKILL.md`: tells ChatGPT when to use Locenti and how (search → save → research → draft → campaign), plus the writing rules and "you cannot send email".
- `assets/`: icon (128 px) and logo (512 px).

Run `npm run plugin:pack` and upload `dist/locenti-plugin.zip` when submitting. Bump `version` in `plugin.json` for each new upload.

## Submitting to the ChatGPT plugin directory

OpenAI's portal and wording change often: check the current steps at platform.openai.com when you submit. What's usually asked for, and what to give:

1. **Verified OpenAI Platform organization** (you, as owner).
2. **Domain verification:** OpenAI shows a token. In Vercel add `OPENAI_APPS_CHALLENGE` = that token, redeploy, then check `https://locenti.com/.well-known/openai-apps-challenge` shows it.
3. **Details:**
   - Name: Locenti
   - Short description: Find local businesses on Google Maps with public emails, research their websites and draft personal cold emails.
   - Category: Business / Productivity / Sales
   - Website `https://locenti.com`, privacy `https://locenti.com/legal/privacy`, terms `https://locenti.com/legal/terms`, support `hello@locenti.com`
   - MCP URL `https://locenti.com/api/mcp`, authentication OAuth
4. **Reviewer account:** create a dedicated Locenti account (e.g. a `review@` address) with a workspace, a few saved leads and an offer profile; give its email and password.
5. **Test prompts that should use Locenti:**
   1. "Find 10 dentists in Austin, Texas that have a public email."
   2. "Save the first five of those as leads in Locenti."
   3. "Research the first lead and tell me what its website is missing."
   4. "Write a short, personal first email to that lead and save it as a draft."
   5. "Create a draft campaign with my saved leads."
6. **Prompts that should NOT use Locenti:**
   1. "What's the capital of France?"
   2. "Write me a poem about the sea."
   3. "Send an email to my boss saying I'll be late." (Locenti can't send email)
7. **Demo video (1–3 minutes):** connect Locenti in ChatGPT (sign-in + Allow) → search → save leads → research → draft → open Locenti and show the draft and campaign waiting for approval.

## Notes

- Tokens are tied to one workspace and the person's role at the time of each call. Removing someone from the workspace cuts the app off.
- Disconnecting on the Agent page, or revoking the token, ends the connection immediately.
- Personal access tokens (`loc_…`) still work for Claude Code, Cursor and other tools that take a token.
