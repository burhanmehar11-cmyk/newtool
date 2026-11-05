/**
 * Minimal Model Context Protocol server core (JSON-RPC 2.0 over the
 * Streamable HTTP transport, stateless, JSON responses). Supports
 * initialize, ping, tools/list and tools/call. Pure: no I/O here.
 */

export const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "locentio", version: "0.1.0" };

export type ToolDef<C> = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Record<string, unknown>, ctx: C) => Promise<unknown>;
};

type Rpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
export type RpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

/** A tool failure the agent should see (shown as an error result, not a protocol error). */
export class ToolError extends Error {}

const err = (id: RpcResponse["id"], code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

export async function handleMessage<C>(msg: unknown, tools: ToolDef<C>[], ctx: C, instructions: string): Promise<RpcResponse | null> {
  const m = (msg ?? {}) as Rpc;
  const id = typeof m.id === "string" || typeof m.id === "number" ? m.id : null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return err(id, -32600, "Invalid request");
  // Notifications (no id) get no response.
  if (m.id === undefined) return null;
  const params = (m.params ?? {}) as Record<string, unknown>;

  switch (m.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: tools.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, ...(annotations ? { annotations } : {}) })) } };
    case "tools/call": {
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${String(params.name)}`);
      const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
      try {
        const out = await tool.run(args, ctx);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }], ...(typeof out === "object" && out !== null && !Array.isArray(out) ? { structuredContent: out } : {}) } };
      } catch (e) {
        const message = e instanceof ToolError ? e.message : "The tool failed unexpectedly. Try again.";
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } };
      }
    }
    default:
      return err(id, -32601, `Method not found: ${m.method}`);
  }
}
