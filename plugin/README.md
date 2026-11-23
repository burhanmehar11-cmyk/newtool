# Locenti plugin for ChatGPT

The package uploaded to OpenAI's plugin directory (Agent Plugins format):

| File | What it is |
|---|---|
| `plugin.json` | Manifest: name, version, descriptions, links, logo, example prompts (`extensions.com.openai.interface`) |
| `mcp.json` | The Locenti MCP server, `https://locenti.com/api/mcp` (people sign in with OAuth) |
| `skills/locenti-prospecting/SKILL.md` | How ChatGPT should use Locenti: search → save → research → draft → campaign, and the writing rules |
| `assets/icon.png`, `assets/logo.png` | Composer icon (128 px) and logo (512 px) |

The MCP server also shows visual cards for search results and leads (`server/mcp/widgets.ts`).

Build the upload file with `npm run plugin:pack` (creates `dist/locenti-plugin.zip`). Submission steps and review materials: `docs/CHATGPT_PLUGIN.md`.
