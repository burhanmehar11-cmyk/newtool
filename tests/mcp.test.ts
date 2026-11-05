import { describe, expect, it } from "vitest";
import { handleMessage, ToolError, type ToolDef } from "@/lib/mcp/protocol";

const tools: ToolDef<{ who: string }>[] = [
  { name: "hello", description: "d", inputSchema: { type: "object" }, annotations: { readOnlyHint: true }, run: async (a, ctx) => ({ hi: `${a.name} from ${ctx.who}` }) },
  { name: "nope", description: "d", inputSchema: { type: "object" }, run: async () => { throw new ToolError("Lead not found."); } },
  { name: "boom", description: "d", inputSchema: { type: "object" }, run: async () => { throw new Error("secret internal detail"); } },
];
const call = (msg: unknown) => handleMessage(msg, tools, { who: "ws" }, "instructions");

describe("MCP protocol core", () => {
  it("negotiates the protocol version and advertises tools", async () => {
    const r = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
    expect(r?.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "locenti" }, instructions: "instructions" });
    const old = await call({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
    expect((old?.result as { protocolVersion: string }).protocolVersion).toBe("2025-11-25");
  });

  it("lists tools without their implementations", async () => {
    const r = await call({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    const list = (r?.result as { tools: Record<string, unknown>[] }).tools;
    expect(list.map((t) => t.name)).toEqual(["hello", "nope", "boom"]);
    expect(list[0]).toEqual({ name: "hello", description: "d", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } });
    expect(list[0]).not.toHaveProperty("run");
  });

  it("calls tools with the caller's context", async () => {
    const r = await call({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hello", arguments: { name: "Sam" } } });
    expect(r?.result).toMatchObject({ structuredContent: { hi: "Sam from ws" }, content: [{ type: "text" }] });
  });

  it("returns tool errors as results, and hides unexpected internals", async () => {
    expect((await call({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } }))?.result).toEqual({ content: [{ type: "text", text: "Lead not found." }], isError: true });
    const boom = await call({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "boom" } });
    expect(JSON.stringify(boom)).not.toContain("secret internal detail");
  });

  it("handles unknown methods, unknown tools, notifications and bad requests", async () => {
    expect((await call({ jsonrpc: "2.0", id: 7, method: "resources/list" }))?.error?.code).toBe(-32601);
    expect((await call({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "missing" } }))?.error?.code).toBe(-32602);
    expect(await call({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect((await call({ id: 9, method: "ping" }))?.error?.code).toBe(-32600);
    expect((await call({ jsonrpc: "2.0", id: 10, method: "ping" }))?.result).toEqual({});
  });
});
