import "server-only";

/**
 * Google Gemini API (server-side only).
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *   Header: x-goog-api-key
 * Free tier available from Google AI Studio; on the free tier Google may use
 * submitted content to improve its products (see docs/DECISIONS.md).
 */

export function geminiKey() {
  return process.env.GEMINI_API_KEY?.trim() || null;
}
/** Google retires models for new keys over time; this is today's default, and a retired one is replaced automatically (below). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
let discovered: string | null = null;

function configuredModel() {
  const m = process.env.GEMINI_MODEL?.trim();
  return m && /^[a-z0-9.-]{3,60}$/.test(m) ? m : null;
}
export function geminiModel() {
  return configuredModel() ?? discovered ?? DEFAULT_GEMINI_MODEL;
}

/** Version number of a plain "gemini-<n>-flash" model, or null for anything else (lite, preview, image, audio…). */
export function flashVersion(name: string) {
  const m = /^(?:models\/)?gemini-(\d+(?:\.\d+)?)-flash$/.exec(name);
  return m ? Number(m[1]) : null;
}

/** Asks Google which models this key can use and picks the newest plain Flash model. */
async function discoverModel(key: string): Promise<string | null> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10_000), cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  const best = (json.models ?? [])
    .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent") && flashVersion(m.name) !== null)
    .sort((a, b) => flashVersion(b.name!)! - flashVersion(a.name!)!)[0];
  return best?.name?.replace(/^models\//, "") ?? null;
}

/** Thinking can be fully switched off only on 2.x Flash models; newer ones get more room instead. */
function thinkingOff(model: string) {
  return /^gemini-2(\.\d+)?-flash/.test(model);
}

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; code: "not_configured" | "auth" | "quota" | "blocked" | "error"; message: string; /** Google's own words, for logs and admins (never contains the key). */ detail?: string };

/**
 * `thinking: false` turns off "thinking" on Flash models: much faster for
 * short answers, and thinking can't use up the output allowance and leave
 * the reply empty. (Pro models can't turn it off, so it's left alone there.)
 */
export async function generateJson(system: string, user: string, schema: object, opts: { thinking?: boolean; maxOutputTokens?: number } = {}): Promise<GeminiResult> {
  const key = geminiKey();
  if (!key) return { ok: false, code: "not_configured", message: "The AI writer isn't set up on this server (GEMINI_API_KEY is missing)." };
  const first = await callModel(key, geminiModel(), system, user, schema, opts);
  // The model was retired (or never existed for this key): find the newest one this key can use, once, and retry.
  if (!first.ok && first.status === 404 && !configuredModel()) {
    const next = await discoverModel(key);
    if (next && next !== geminiModel()) {
      discovered = next;
      console.warn(`[gemini] model unavailable; switched to ${next}`);
      return strip(await callModel(key, next, system, user, schema, opts));
    }
  }
  return strip(first);
}

function strip(r: GeminiResult & { status?: number }): GeminiResult {
  const { status: _status, ...rest } = r;
  void _status;
  return rest as GeminiResult;
}

async function callModel(key: string, model: string, system: string, user: string, schema: object, opts: { thinking?: boolean; maxOutputTokens?: number }): Promise<GeminiResult & { status?: number }> {
  const noThinking = opts.thinking === false && thinkingOff(model);
  // Where thinking can't be switched off it shares the output allowance, so leave room for the answer.
  const maxOutputTokens = opts.thinking === false && !noThinking ? Math.max(opts.maxOutputTokens ?? 2048, 4096) : (opts.maxOutputTokens ?? 2048);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: schema,
        ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  }).catch((e: Error) => (e.name === "TimeoutError" ? "timeout" : null));
  if (res === "timeout") return { ok: false, code: "error", message: "The AI took too long. Try again." };
  if (!res) return { ok: false, code: "error", message: "Couldn't reach the AI service." };
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string; status?: string; details?: { reason?: string }[] };
  };
  const detail = json.error ? `HTTP ${res.status} ${json.error.status ?? ""}: ${(json.error.message ?? "").replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]").slice(0, 300)}`.trim() : undefined;
  const reasons = (json.error?.details ?? []).map((d) => d.reason ?? "");
  if (res.status === 429) return { ok: false, code: "quota", message: "The AI's free limit is used up for now. Try again later.", detail };
  if (reasons.includes("SERVICE_DISABLED")) return { ok: false, code: "auth", message: "The Gemini API isn't turned on for this key's Google Cloud project.", detail };
  if (reasons.includes("API_KEY_SERVICE_BLOCKED")) return { ok: false, code: "auth", message: "This API key isn't allowed to use the Gemini API (check the key's API restrictions).", detail };
  if (res.status === 400 && /API key/i.test(json.error?.message ?? "")) return { ok: false, code: "auth", message: "Google rejected the Gemini API key.", detail };
  if (res.status === 401 || res.status === 403) return { ok: false, code: "auth", message: "Google rejected the Gemini API key.", detail };
  if (res.status === 404) return { ok: false, code: "error", message: `The AI model "${model}" isn't available. Check GEMINI_MODEL.`, detail, status: 404 };
  if (!res.ok) return { ok: false, code: "error", message: `The AI service returned an error (HTTP ${res.status}).`, detail };
  if (json.promptFeedback?.blockReason) return { ok: false, code: "blocked", message: "The AI declined to write this email." };
  const c = json.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text) return { ok: false, code: c?.finishReason === "SAFETY" ? "blocked" : "error", message: "The AI returned nothing. Try again.", detail: `finishReason ${c?.finishReason ?? "none"}` };
  if (c?.finishReason === "MAX_TOKENS") return { ok: false, code: "error", message: "The AI's answer was cut off. Try again.", detail: "finishReason MAX_TOKENS" };
  return { ok: true, text };
}
