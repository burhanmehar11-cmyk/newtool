import { afterEach, describe, expect, it, vi } from "vitest";

/** Gemini calls: thinking can be turned off on Flash, and Google's errors are explained (without the key). */

vi.mock("server-only", () => ({}));
const { generateJson, geminiModel, flashVersion, DEFAULT_GEMINI_MODEL } = await import("@/server/ai/gemini");

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
  it("turns thinking off on 2.x Flash when asked", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
    const f = reply(200, { candidates: [{ content: { parts: [{ text: '{"answer":"hi"}' }] }, finishReason: "STOP" }] });
    expect(await generateJson("s", "u", {}, { thinking: false, maxOutputTokens: 1024 })).toMatchObject({ ok: true, text: '{"answer":"hi"}' });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.generationConfig).toMatchObject({ maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } });
    await generateJson("s", "u", {});
    expect(JSON.parse((f.mock.calls[1] as unknown as [string, { body: string }])[1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  it("uses the current default model, leaving room for thinking it can't turn off", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const f = reply(200, { candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] });
    await generateJson("s", "u", {}, { thinking: false, maxOutputTokens: 1024 });
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    const cfg = JSON.parse(init.body).generationConfig;
    expect(cfg.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(cfg.maxOutputTokens).toBe(4096);
  });

  it("asks again without a thinking level if a model rejects it", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const bodies: { thinkingConfig?: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      const cfg = JSON.parse(init.body).generationConfig;
      bodies.push(cfg);
      return cfg.thinkingConfig
        ? new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: "Unknown name thinkingLevel in thinking_config" } }), { status: 400 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] }), { status: 200 });
    }));
    expect(await g.generateJson("s", "u", {}, { thinking: false })).toMatchObject({ ok: true, text: "{}" });
    expect(await g.generateJson("s", "u", {}, { thinking: false })).toMatchObject({ ok: true, text: "{}" });
    expect(bodies.map((b) => !!b.thinkingConfig)).toEqual([true, false, false]);
  });

  it("moves to another model when one is too slow, instead of waiting out the whole budget", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { signal?: AbortSignal }) => {
      if (url.includes("/models?")) return new Response(JSON.stringify({ models: [
        { name: `models/${g.DEFAULT_GEMINI_MODEL}`, supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.7-flash", supportedGenerationMethods: ["generateContent"] },
      ] }), { status: 200 });
      const model = /models\/([^:]+):/.exec(url)![1];
      calls.push(model);
      if (model === "gemini-3.7-flash") return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"fast"}' }] }, finishReason: "STOP" }] }), { status: 200 });
      // The default model hangs until its time slot runs out.
      return new Promise<Response>((_, fail) => init.signal?.addEventListener("abort", () => fail(Object.assign(new Error("t"), { name: "TimeoutError" }))));
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const started = Date.now();
    expect(await g.generateJson("s", "u", {}, { budgetMs: 16_000 })).toMatchObject({ ok: true, text: '{"answer":"fast"}' });
    expect(calls).toEqual([g.DEFAULT_GEMINI_MODEL, "gemini-3.7-flash"]);
    expect(Date.now() - started).toBeLessThan(12_000);
  }, 20_000);

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

  it("picks only plain Flash models when looking for a replacement", () => {
    expect(flashVersion("models/gemini-3.8-flash")).toBe(3.8);
    expect(flashVersion("gemini-4-flash")).toBe(4);
    expect(flashVersion("models/gemini-3.8-flash-lite")).toBeNull();
    expect(flashVersion("models/gemini-3.8-flash-preview-09")).toBeNull();
    expect(flashVersion("models/gemini-3-pro")).toBeNull();
  });

  // Last: the replacement it finds is remembered for the rest of the run.
  it("switches to the newest Flash model this key can use when the model is retired", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const f = vi.fn(async (url: string) => {
      if (url.includes("/models?")) return new Response(JSON.stringify({ models: [
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-4.1-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-5-flash-lite", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-5-flash", supportedGenerationMethods: ["embedContent"] },
      ] }), { status: 200 });
      if (url.includes("gemini-4.1-flash:generateContent")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] }, finishReason: "STOP" }] }), { status: 200 });
      return new Response(JSON.stringify({ error: { status: "NOT_FOUND", message: "This model is no longer available to new users." } }), { status: 404 });
    });
    vi.stubGlobal("fetch", f);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await generateJson("s", "u", {})).toMatchObject({ ok: true, text: '{"answer":"ok"}' });
    expect(geminiModel()).toBe("gemini-4.1-flash");
  });

  it("keeps an explicitly chosen model and explains the error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "gemini-old-flash");
    reply(404, { error: { status: "NOT_FOUND", message: "gone" } });
    const r = await generateJson("s", "u", {});
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/gemini-old-flash/) });
    expect(r).not.toHaveProperty("status");
  });

  it("retries a busy model, then answers with the next best model", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/models?")) return new Response(JSON.stringify({ models: [
        { name: `models/${g.DEFAULT_GEMINI_MODEL}`, supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.8-flash-lite", supportedGenerationMethods: ["generateContent"] },
      ] }), { status: 200 });
      const model = /models\/([^:]+):/.exec(url)![1];
      calls.push(model);
      if (model === "gemini-3-flash") return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] }, finishReason: "STOP" }] }), { status: 200 });
      return new Response(JSON.stringify({ error: { status: "UNAVAILABLE", message: "This model is currently experiencing high demand." } }), { status: 503 });
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await g.generateJson("s", "u", {})).toMatchObject({ ok: true, text: '{"answer":"ok"}' });
    expect(calls).toEqual([g.DEFAULT_GEMINI_MODEL, g.DEFAULT_GEMINI_MODEL, "gemini-3-flash"]);
  });

  it("says the AI is busy when every model is", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("/models?")
        ? new Response(JSON.stringify({ models: [{ name: "models/gemini-3-flash", supportedGenerationMethods: ["generateContent"] }] }), { status: 200 })
        : new Response(JSON.stringify({ error: { status: "UNAVAILABLE", message: "high demand" } }), { status: 503 }),
    ));
    const r = await g.generateJson("s", "u", {});
    expect(r).toMatchObject({ ok: false, code: "busy", message: expect.stringMatching(/busy/) });
    expect(r).not.toHaveProperty("retryable");
  });

  it("uses another model when one's allowance is used up, past retired ones, and rests the used-up one", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/models?")) return new Response(JSON.stringify({ models: ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ["generateContent"] })) }), { status: 200 });
      const model = /models\/([^:]+):/.exec(url)![1];
      calls.push(model);
      if (model === "gemini-3.8-flash") return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota. Quota exceeded for metric: free_tier_requests, limit: 20" } }), { status: 429 });
      if (model === "gemini-2.5-flash") return new Response(JSON.stringify({ error: { status: "NOT_FOUND", message: "no longer available to new users" } }), { status: 404 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"lite"}' }] }, finishReason: "STOP" }] }), { status: 200 });
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await g.generateJson("s", "u", {})).toMatchObject({ ok: true, text: '{"answer":"lite"}' });
    expect(calls).toEqual(["gemini-3.8-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"]);
    // Next question skips the used-up model and starts with the next one available.
    calls.length = 0;
    expect(await g.generateJson("s", "u", {})).toMatchObject({ ok: true, text: '{"answer":"lite"}' });
    expect(calls).toEqual(["gemini-2.5-flash", "gemini-3.5-flash-lite"]);
  });

  it("tries the fastest (Flash-Lite) model first when asked", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/models?")) return new Response(JSON.stringify({ models: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash"].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ["generateContent"] })) }), { status: 200 });
      calls.push(/models\/([^:]+):/.exec(url)![1]);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "STOP" }] }), { status: 200 });
    }));
    expect(await g.generateJson("s", "u", {}, { prefer: "lite" })).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite" });
    expect(calls).toEqual(["gemini-3.5-flash-lite"]);
  });

  it("races a second model when the first is slow, and takes the first answer", async () => {
    vi.resetModules();
    const g = await import("@/server/ai/gemini");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const calls: string[] = [];
    let aborted = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { signal?: AbortSignal }) => {
      if (url.includes("/models?")) return new Response(JSON.stringify({ models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"].map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ["generateContent"] })) }), { status: 200 });
      const model = /models\/([^:]+):/.exec(url)![1];
      calls.push(model);
      if (model === "gemini-3.8-flash") return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"second"}' }] }, finishReason: "STOP" }] }), { status: 200 });
      // The first model hangs until it's cancelled.
      return new Promise<Response>((_, fail) =>
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          fail(Object.assign(new Error("aborted"), { name: "AbortError" }));
        }),
      );
    }));
    const started = Date.now();
    expect(await g.generateJson("s", "u", {}, { prefer: "lite", hedgeAfterMs: 200, budgetMs: 15_000 })).toMatchObject({ ok: true, text: '{"answer":"second"}', model: "gemini-3.8-flash" });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(calls).toEqual(["gemini-3.5-flash-lite", "gemini-3.8-flash"]);
    expect(aborted).toBe(true); // the slow one is cancelled
  });
});
