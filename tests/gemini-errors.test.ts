import { afterEach, describe, expect, it, vi } from "vitest";

/** Gemini calls: thinking can be turned off on Flash, and Google's errors are explained (without the key). */

vi.mock("server-only", () => ({}));
const { generateJson } = await import("@/server/ai/gemini");

function reply(status: number, body: unknown) {
  const f = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("generateJson", () => {
  it("turns thinking off on Flash when asked", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const f = reply(200, { candidates: [{ content: { parts: [{ text: '{"answer":"hi"}' }] }, finishReason: "STOP" }] });
    expect(await generateJson("s", "u", {}, { thinking: false, maxOutputTokens: 1024 })).toEqual({ ok: true, text: '{"answer":"hi"}' });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.generationConfig).toMatchObject({ maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } });
    await generateJson("s", "u", {});
    expect(JSON.parse((f.mock.calls[1] as unknown as [string, { body: string }])[1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  it("leaves thinking alone on Pro models", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-pro");
    const f = reply(200, { candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] });
    await generateJson("s", "u", {}, { thinking: false });
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  it("explains a disabled API or a restricted key, hiding any key in Google's message", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    reply(403, { error: { status: "PERMISSION_DENIED", message: "Generative Language API has not been used in project 123", details: [{ reason: "SERVICE_DISABLED" }] } });
    expect(await generateJson("s", "u", {})).toMatchObject({ ok: false, code: "auth", message: expect.stringMatching(/isn't turned on/), detail: expect.stringContaining("HTTP 403 PERMISSION_DENIED") });
    reply(403, { error: { status: "PERMISSION_DENIED", message: "Requests from key AIzaSyA1234567890abcdefghijklmn are blocked.", details: [{ reason: "API_KEY_SERVICE_BLOCKED" }] } });
    const r = await generateJson("s", "u", {});
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/API restrictions/) });
    expect(JSON.stringify(r)).not.toContain("AIzaSy");
  });

  it("reports an answer cut off by the output limit", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    reply(200, { candidates: [{ content: { parts: [{ text: '{"answer":"Loc' }] }, finishReason: "MAX_TOKENS" }] });
    expect(await generateJson("s", "u", {})).toMatchObject({ ok: false, detail: "finishReason MAX_TOKENS" });
  });
});
