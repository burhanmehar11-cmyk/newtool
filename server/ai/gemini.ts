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
/** Gemini 3 and later take a thinking level instead; "low" keeps short answers quick. */
function thinkingLevelModel(model: string) {
  return /^gemini-([3-9]|\d{2,})(\.\d+)?-flash/.test(model);
}
/** Models whose allowance ran out recently, and until when to leave them alone. */
const restUntil = new Map<string, number>();
function resting(model: string) {
  return (restUntil.get(model) ?? 0) > Date.now();
}
/** Models that rejected the thinking level (asked once, then remembered). */
const noThinkingLevel = new Set<string>();

export type GeminiResult =
  | { ok: true; text: string; /** The model that answered. */ model?: string }
  | { ok: false; code: "not_configured" | "auth" | "quota" | "busy" | "blocked" | "error"; message: string; /** Google's own words, for logs and admins (never contains the key). */ detail?: string };

type Opts = {
  thinking?: boolean;
  maxOutputTokens?: number;
  /** Total time allowed across retries (default 45s). */
  budgetMs?: number;
  /** "lite": try the fastest models (Flash-Lite) first, for short answers. */
  prefer?: "lite";
  /** If the first model hasn't answered after this long, ask a second one at the same time and take whichever answers first. */
  hedgeAfterMs?: number;
};
type Attempt = GeminiResult & { status?: number; retryable?: boolean; moveOn?: boolean };

/** Models to try, best first, skipping any that are resting after running out of allowance (unless that leaves none). */
function ordered(list: string[], prefer?: "lite") {
  const flash = list.filter((m) => flashVersion(m) !== null);
  const lite = list.filter((m) => flashVersion(m) === null);
  const all = prefer === "lite" ? [...lite, ...flash] : [...flash, ...lite];
  const awake = all.filter((m) => !resting(m));
  return awake.length ? awake : all;
}

/**
 * `thinking: false` turns off "thinking" where the model allows it (2.x
 * Flash) or asks for a low level (3.x and later). When Google says a model
 * is busy (503), out of allowance (429) or it's slow, the next best model
 * this key can use is tried, within `budgetMs`; with `hedgeAfterMs` a second
 * model races a slow first one. A retired model (404) is replaced by the
 * newest Flash model, unless GEMINI_MODEL picks one.
 */
export async function generateJson(system: string, user: string, schema: object, opts: Opts = {}): Promise<GeminiResult> {
  const key = geminiKey();
  if (!key) return { ok: false, code: "not_configured", message: "The AI writer isn't set up on this server (GEMINI_API_KEY is missing)." };
  const budget = opts.budgetMs ?? 45_000;
  const deadline = Date.now() + budget;
  const left = () => deadline - Date.now();
  // One slow model mustn't use up the whole budget: cap each try so there's time left for a backup.
  const cap = Math.max(6_000, Math.round(budget * 0.5));
  const slot = () => Math.min(left(), cap);
  const call = (m: string, signal?: AbortSignal) => callModel(key, m, system, user, schema, opts, slot(), signal);

  // The order to try models in. GEMINI_MODEL, when set, always goes first.
  const queue: string[] = [];
  const add = (ms: string[]) => ms.forEach((m) => !queue.includes(m) && queue.push(m));
  const configured = configuredModel();
  if (configured) add([configured]);
  else if (opts.prefer === "lite") add(ordered(await availableModels(key), "lite"));
  if (!queue.length) add([resting(geminiModel()) ? (ordered(await availableModels(key))[0] ?? geminiModel()) : geminiModel()]);
  const tried = new Set<string>();
  const next = () => {
    const m = queue.find((x) => !tried.has(x));
    if (m) tried.add(m);
    return m;
  };

  const first = next()!;
  let r: Attempt;
  if (opts.hedgeAfterMs) {
    if (queue.length < 2 && !configured) add(ordered(await availableModels(key), opts.prefer));
    r = await hedged(call, first, next, opts.hedgeAfterMs);
  } else {
    r = await call(first);
  }
  if (r.ok) return strip(r);

  // Retired model: remember the newest Flash model this key can use.
  if (r.status === 404 && !configured && first === geminiModel()) {
    const replacement = (await availableModels(key)).find((m) => flashVersion(m) !== null && m !== first && !resting(m));
    if (replacement) {
      discovered = replacement;
      console.warn(`[gemini] ${first} unavailable; switched to ${replacement}`);
      queue.unshift(replacement);
    }
  }

  if (r.retryable || (r.status === 404 && !configured)) {
    // "Busy" often clears in a second; slow or out-of-allowance means move on.
    if (r.retryable && !r.moveOn && tried.size === 1 && left() > 6_000) {
      await new Promise((ok) => setTimeout(ok, 600));
      r = await call(first);
      if (r.ok) return strip(r);
    }
    add(ordered(await availableModels(key), opts.prefer));
    for (let m = next(), n = 0; m && n < 4; m = next(), n++) {
      // Keep going past models that are busy, slow, out of allowance or retired for this key.
      if (!(r.retryable || r.status === 404) || left() < 3_000) break;
      const why = r.ok ? "" : r.code;
      r = await call(m);
      if (r.ok) {
        console.warn(`[gemini] ${first} unavailable (${why}); answered with ${m}`);
        return strip(r);
      }
    }
  }
  return strip(r);
}

/** Starts `first`; if it hasn't answered after `ms`, starts the next model too and takes whichever answers first. */
async function hedged(call: (m: string, signal?: AbortSignal) => Promise<Attempt>, first: string, next: () => string | undefined, ms: number): Promise<Attempt> {
  const a1 = new AbortController();
  const p1 = call(first, a1.signal);
  const early = await Promise.race([p1, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);
  if (early) return early;
  const second = next();
  if (!second) return p1;
  const a2 = new AbortController();
  const p2 = call(second, a2.signal);
  return new Promise<Attempt>((resolve) => {
    let pending = 2;
    const settle = (r: Attempt, other: AbortController) => {
      pending--;
      if (r.ok) {
        other.abort();
        resolve(r);
      } else if (pending === 0) resolve(r);
    };
    void p1.then((r) => settle(r, a2));
    void p2.then((r) => settle(r, a1));
  });
}

function strip(r: Attempt): GeminiResult {
  const { status: _s, retryable: _r, moveOn: _t, thinkingLevelUsed: _l, ...rest } = r as Attempt & { thinkingLevelUsed?: boolean };
  void [_s, _r, _t, _l];
  return rest as GeminiResult;
}

async function callModel(key: string, model: string, system: string, user: string, schema: object, opts: Opts, timeoutMs: number, signal?: AbortSignal): Promise<Attempt> {
  const r = await callOnce(key, model, system, user, schema, opts, timeoutMs, signal);
  // A model that doesn't take a thinking level: remember, and ask again without it.
  if (!r.ok && r.status === 400 && r.thinkingLevelUsed && /thinking/i.test(r.detail ?? "")) {
    noThinkingLevel.add(model);
    return callOnce(key, model, system, user, schema, opts, timeoutMs, signal);
  }
  return r;
}

async function callOnce(key: string, model: string, system: string, user: string, schema: object, opts: Opts, timeoutMs: number, signal?: AbortSignal): Promise<Attempt & { thinkingLevelUsed?: boolean }> {
  if (timeoutMs < 1_000) return { ok: false, code: "busy", message: "The AI took too long. Try again.", retryable: false };
  const noThinking = opts.thinking === false && thinkingOff(model);
  const lowThinking = opts.thinking === false && !noThinking && thinkingLevelModel(model) && !noThinkingLevel.has(model);
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
        ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : lowThinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    }),
    signal: signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  }).catch((e: Error) => (e.name === "TimeoutError" ? "timeout" : null));
  if (res === "timeout") return { ok: false, code: "busy", message: "The AI took too long. Try again.", detail: `${model}: timed out`, retryable: true, moveOn: true };
  if (!res) return { ok: false, code: "error", message: "Couldn't reach the AI service." };
  const json = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    error?: { message?: string; status?: string; details?: { reason?: string }[] };
  };
  const detail = json.error ? `HTTP ${res.status} ${json.error.status ?? ""}: ${(json.error.message ?? "").replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]").slice(0, 300)}`.trim() : undefined;
  const reasons = (json.error?.details ?? []).map((d) => d.reason ?? "");
  // Each model has its own allowance, so another model may still have room.
  if (res.status === 429) restUntil.set(model, Date.now() + (/per ?day/i.test(json.error?.message ?? "") ? 60 : 2) * 60_000);
  if (res.status === 429) return { ok: false, code: "quota", message: "The AI's free limit is used up for now. Try again later.", detail: `${model}: ${(json.error?.message ?? "").replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]").slice(0, 700)}`, retryable: true, moveOn: true };
  if (reasons.includes("SERVICE_DISABLED")) return { ok: false, code: "auth", message: "The Gemini API isn't turned on for this key's Google Cloud project.", detail };
  if (reasons.includes("API_KEY_SERVICE_BLOCKED")) return { ok: false, code: "auth", message: "This API key isn't allowed to use the Gemini API (check the key's API restrictions).", detail };
  if (res.status === 400 && /API key/i.test(json.error?.message ?? "")) return { ok: false, code: "auth", message: "Google rejected the Gemini API key.", detail };
  if (res.status === 400 && lowThinking) return { ok: false, code: "error", message: `The AI service returned an error (HTTP 400).`, detail, status: 400, thinkingLevelUsed: true };
  if (res.status === 401 || res.status === 403) return { ok: false, code: "auth", message: "Google rejected the Gemini API key.", detail };
  if (res.status === 404) return { ok: false, code: "error", message: `The AI model "${model}" isn't available. Check GEMINI_MODEL.`, detail, status: 404 };
  if (res.status === 500 || res.status === 503 || res.status === 504) return { ok: false, code: "busy", message: "The AI is very busy right now. Try again in a moment.", detail: `${model}: ${detail ?? `HTTP ${res.status}`}`, retryable: true };
  if (!res.ok) return { ok: false, code: "error", message: `The AI service returned an error (HTTP ${res.status}).`, detail };
  if (json.promptFeedback?.blockReason) return { ok: false, code: "blocked", message: "The AI declined to write this email." };
  const c = json.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text) return { ok: false, code: c?.finishReason === "SAFETY" ? "blocked" : "error", message: "The AI returned nothing. Try again.", detail: `finishReason ${c?.finishReason ?? "none"}` };
  if (c?.finishReason === "MAX_TOKENS") return { ok: false, code: "error", message: "The AI's answer was cut off. Try again.", detail: "finishReason MAX_TOKENS" };
  return { ok: true, text, model };
}
