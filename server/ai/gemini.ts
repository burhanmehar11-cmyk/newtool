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

/** Version of a "gemini-<n>-flash-lite" model, or null. Used only as a backup when Flash models are busy. */
function liteVersion(name: string) {
  const m = /^(?:models\/)?gemini-(\d+(?:\.\d+)?)-flash-lite$/.exec(name);
  return m ? Number(m[1]) : null;
}

/**
 * The models this key can use, best first: plain Flash models newest first,
 * then Flash-Lite. Asked of Google at most every 10 minutes.
 */
let modelList: { at: number; models: string[] } | null = null;
export async function availableModels(key: string): Promise<string[]> {
  if (modelList && Date.now() - modelList.at < 10 * 60_000) return modelList.models;
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8_000), cache: "no-store" }).catch(() => null);
  if (!res?.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  const usable = (json.models ?? []).filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => m.name!.replace(/^models\//, ""));
  const flash = usable.filter((n) => flashVersion(n) !== null).sort((a, b) => flashVersion(b)! - flashVersion(a)!);
  const lite = usable.filter((n) => liteVersion(n) !== null).sort((a, b) => liteVersion(b)! - liteVersion(a)!);
  modelList = { at: Date.now(), models: [...flash, ...lite] };
  return modelList.models;
}

/** Thinking can be fully switched off only on 2.x Flash models; newer ones get more room instead. */
function thinkingOff(model: string) {
  return /^gemini-2(\.\d+)?-flash/.test(model);
}

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; code: "not_configured" | "auth" | "quota" | "busy" | "blocked" | "error"; message: string; /** Google's own words, for logs and admins (never contains the key). */ detail?: string };

type Opts = { thinking?: boolean; maxOutputTokens?: number; /** Total time allowed across retries (default 45s). */ budgetMs?: number };
type Attempt = GeminiResult & { status?: number; retryable?: boolean };

/**
 * `thinking: false` turns off "thinking" where the model allows it (2.x
 * Flash): much faster for short answers. When Google says the model is
 * busy (503) or it times out, it retries once and then tries the next best
 * model this key can use, within `budgetMs`. A retired model (404) is
 * replaced by the newest Flash model, unless GEMINI_MODEL picks one.
 */
export async function generateJson(system: string, user: string, schema: object, opts: Opts = {}): Promise<GeminiResult> {
  const key = geminiKey();
  if (!key) return { ok: false, code: "not_configured", message: "The AI writer isn't set up on this server (GEMINI_API_KEY is missing)." };
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const left = () => deadline - Date.now();
  const primary = geminiModel();
  let r: Attempt = await callModel(key, primary, system, user, schema, opts, left());
  if (r.ok) return r;

  if (r.status === 404 && !configuredModel()) {
    const next = (await availableModels(key)).find((m) => flashVersion(m) !== null && m !== primary);
    if (next) {
      discovered = next;
      console.warn(`[gemini] ${primary} unavailable; switched to ${next}`);
      r = await callModel(key, next, system, user, schema, opts, left());
      if (r.ok) return r;
    }
  }

  if (r.retryable) {
    const current = geminiModel();
    if (left() > 6_000) {
      await new Promise((ok) => setTimeout(ok, 800));
      r = await callModel(key, current, system, user, schema, opts, left());
      if (r.ok) return r;
    }
    for (const backup of (await availableModels(key)).filter((m) => m !== current).slice(0, 3)) {
      if (!r.retryable || left() < 4_000) break;
      r = await callModel(key, backup, system, user, schema, opts, left());
      if (r.ok) {
        console.warn(`[gemini] ${current} busy; answered with ${backup}`);
        return r;
      }
    }
  }
  return strip(r);
}

function strip(r: Attempt): GeminiResult {
  const { status: _status, retryable: _retryable, ...rest } = r;
  void _status;
  void _retryable;
  return rest as GeminiResult;
}

async function callModel(key: string, model: string, system: string, user: string, schema: object, opts: Opts, timeoutMs: number): Promise<Attempt> {
  if (timeoutMs < 1_000) return { ok: false, code: "busy", message: "The AI took too long. Try again.", retryable: false };
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
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  }).catch((e: Error) => (e.name === "TimeoutError" ? "timeout" : null));
  if (res === "timeout") return { ok: false, code: "busy", message: "The AI took too long. Try again.", detail: `${model}: timed out`, retryable: true };
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
  if (res.status === 500 || res.status === 503 || res.status === 504) return { ok: false, code: "busy", message: "The AI is very busy right now. Try again in a moment.", detail: `${model}: ${detail ?? `HTTP ${res.status}`}`, retryable: true };
  if (!res.ok) return { ok: false, code: "error", message: `The AI service returned an error (HTTP ${res.status}).`, detail };
  if (json.promptFeedback?.blockReason) return { ok: false, code: "blocked", message: "The AI declined to write this email." };
  const c = json.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text) return { ok: false, code: c?.finishReason === "SAFETY" ? "blocked" : "error", message: "The AI returned nothing. Try again.", detail: `finishReason ${c?.finishReason ?? "none"}` };
  if (c?.finishReason === "MAX_TOKENS") return { ok: false, code: "error", message: "The AI's answer was cut off. Try again.", detail: "finishReason MAX_TOKENS" };
  return { ok: true, text };
}
