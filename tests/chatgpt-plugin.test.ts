import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The ChatGPT plugin package and the visual cards the MCP server offers. */

vi.mock("server-only", () => ({}));
const { handleMessage } = await import("@/lib/mcp/protocol");
const { MCP_RESOURCES, SEARCH_CARD_URI, LEAD_CARD_URI, MCP_APP_MIME } = await import("@/server/mcp/widgets");
const { mcpTools, MCP_INSTRUCTIONS } = await import("@/server/mcp/tools");

const dir = resolve(__dirname, "../plugin");
const manifest = JSON.parse(readFileSync(resolve(dir, "plugin.json"), "utf8"));

describe("plugin package", () => {
  it("has the manifest fields OpenAI requires, with paths that exist inside the package", () => {
    expect(manifest).toMatchObject({ name: "locenti", version: expect.stringMatching(/^\d+\.\d+\.\d+$/), description: expect.any(String), author: { name: "Locenti" } });
    const ui = manifest.extensions["com.openai"].interface;
    expect(ui.displayName).toBe("Locenti");
    expect(ui.shortDescription.length).toBeLessThanOrEqual(125);
    for (const k of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) expect(ui[k]).toMatch(/^https:\/\/locenti\.com/);
    for (const k of ["composerIcon", "logo"]) {
      expect(ui[k]).toMatch(/^\.\/[^.]/);
      expect(existsSync(resolve(dir, ui[k]))).toBe(true);
    }
  });

  it("points at the MCP server and ships a skill with a name and description", () => {
    expect(JSON.parse(readFileSync(resolve(dir, "mcp.json"), "utf8"))).toEqual({ mcpServers: { locenti: { type: "http", url: "https://locenti.com/api/mcp" } } });
    const skill = readFileSync(resolve(dir, "skills/locenti-prospecting/SKILL.md"), "utf8");
    expect(skill).toMatch(/^---\nname: locenti-prospecting\ndescription: .{40,}\n---\n/);
    expect(skill).toMatch(/cannot send email/i);
  });
});

describe("visual cards", () => {
  const call = (method: string, params: unknown = {}) => handleMessage({ jsonrpc: "2.0", id: 1, method, params }, mcpTools, {} as never, MCP_INSTRUCTIONS, MCP_RESOURCES);

  it("lists and serves both cards, self-contained", async () => {
    const init = (await call("initialize", { protocolVersion: "2025-06-18" })) as { result: { capabilities: Record<string, unknown> } };
    expect(init.result.capabilities.resources).toBeTruthy();
    const list = (await call("resources/list")) as { result: { resources: { uri: string; mimeType: string }[] } };
    expect(list.result.resources.map((r) => r.uri)).toEqual([SEARCH_CARD_URI, LEAD_CARD_URI]);
    for (const uri of [SEARCH_CARD_URI, LEAD_CARD_URI]) {
      const r = (await call("resources/read", { uri })) as { result: { contents: { mimeType: string; text: string }[] } };
      expect(r.result.contents[0].mimeType).toBe(MCP_APP_MIME);
      expect(r.result.contents[0].text).toMatch(/^<!doctype html>/);
      expect(r.result.contents[0].text).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\/(?!\\\/)/); // nothing loaded from elsewhere
    }
    expect(await call("resources/read", { uri: "ui://nope" })).toMatchObject({ error: { code: -32002 } });
  });

  it("links the search and lead tools to their cards", async () => {
    const tools = ((await call("tools/list")) as { result: { tools: { name: string; _meta?: Record<string, unknown> }[] } }).result.tools;
    const meta = (n: string) => tools.find((t) => t.name === n)?._meta as { ui?: { resourceUri: string }; "openai/outputTemplate"?: string } | undefined;
    expect(meta("search_google_maps")).toMatchObject({ ui: { resourceUri: SEARCH_CARD_URI }, "openai/outputTemplate": SEARCH_CARD_URI });
    expect(meta("get_lead")).toMatchObject({ ui: { resourceUri: LEAD_CARD_URI }, "openai/outputTemplate": LEAD_CARD_URI });
    expect(meta("list_leads")).toBeUndefined();
  });
});
