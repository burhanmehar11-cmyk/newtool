import "server-only";
import { z } from "zod";
import { brand } from "@/config/brand";
import { PRODUCT_FACTS, QUICK_PICKS } from "@/lib/help-content";
import { generateJson, geminiKey } from "@/server/ai/gemini";
import { requireUser } from "@/server/auth";
import { clientIp } from "@/server/session";

/**
 * The AI help assistant on Help & Support: answers questions about using
 * Locenti from the product's own help content (Gemini). It has no access to
 * the person's data and can't change anything; when it can't help, it offers
 * to turn the conversation into a support request.
 */

export function helpAssistantAvailable() {
  return !!geminiKey();
}

const TOPICS = ["account", "billing", "search", "mailbox", "campaigns", "bug", "feature", "other"] as const;
const inputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(12),
});

// A few questions a minute per person, so one tab can't use up the AI allowance.
const recent = new Map<string, number[]>();
function allowed(key: string, perMinute = 6, perHour = 40) {
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 60 * 60_000);
  if (list.length >= perHour || list.filter((t) => now - t < 60_000).length >= perMinute) return false;
  list.push(now);
  recent.set(key, list);
  if (recent.size > 5000) for (const [k, v] of recent) if (!v.some((t) => now - t < 60 * 60_000)) recent.delete(k);
  return true;
}

const KNOWLEDGE = `FACTS:
${PRODUCT_FACTS}

HELP ARTICLES:
${QUICK_PICKS.map((p) => `Q: ${p.title}\nA: ${p.answer.join(" ")}`).join("\n\n")}

Contact: ${brand.supportEmail}`;

const SYSTEM = `You are Locenti's help assistant inside the Locenti app (Help & Support page).
Answer questions about using Locenti, using ONLY the facts and help articles below. Be friendly and brief: at most about 120 words, short numbered steps when there are steps, plain text (no markdown headings or tables).
Rules:
- Never invent features, prices, limits, dates or policies that aren't below. If the answer isn't below, say you're not sure and suggest sending a request to the team.
- You can't see the person's account, data, campaigns or bills, and you can't change anything. For anything specific to their account (a charge, missing data, an error that keeps happening, a bug), suggest sending a request.
- Never ask for passwords, API keys or payment details.
- Off-topic questions: politely say you can only help with Locenti.
- Reply in the language the person writes in.
Set suggestRequest to true when the team should look at it, with a short subject and the best topic.

${KNOWLEDGE}`;

const VISITOR_SYSTEM = `You are Locenti's AI assistant on the Locenti website (locenti.com), talking with a visitor who probably doesn't have an account yet.
Help them understand what Locenti does, who it's for, how it works and how the free trial works, using ONLY the facts and help articles below. Be friendly, clear and brief: at most about 100 words, plain text (no markdown headings or tables).
Rules:
- Never invent features, prices, limits, dates or policies that aren't below. Paid plan prices aren't announced yet: say plans are coming soon and the free trial needs no card.
- When it fits, invite them to start the free trial (the "Start free trial" button, or locenti.com/sign-up), without being pushy.
- You can't see any account. If they already have an account and need help with it, tell them to sign in and use Help & Support.
- Never ask for passwords, API keys or payment details.
- Off-topic questions: politely say you can only help with Locenti.
- Reply in the language the person writes in.
Set suggestRequest to true when a person from the team should answer (partnerships, custom needs, press, anything you're unsure about), with a short subject and the best topic.

${KNOWLEDGE}`;

const SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    suggestRequest: { type: "boolean" },
    topic: { type: "string", enum: [...TOPICS] },
    subject: { type: "string" },
  },
  required: ["answer", "suggestRequest", "topic", "subject"],
};

export type HelpAnswer = { ok: true; answer: string; suggestRequest: boolean; topic: (typeof TOPICS)[number]; subject: string } | { ok: false; error: string };

export async function askHelpAssistant(input: unknown): Promise<HelpAnswer> {
  const user = await requireUser("/app/support");
  const p = inputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Ask a question first." };
  if (!helpAssistantAvailable()) return { ok: false, error: "The assistant isn't available right now. Pick a Quick pick or send us a request below." };
  if (!allowed(user.id)) return { ok: false, error: "That's a lot of questions in a short time. Wait a minute, or send us a request below." };
  return answer(SYSTEM, p.data.messages);
}

/** The same assistant for signed-out visitors on the website, limited per IP address and overall. */
export async function askVisitorAssistant(input: unknown): Promise<HelpAnswer> {
  const p = inputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Ask a question first." };
  if (!helpAssistantAvailable()) return { ok: false, error: "The assistant isn't available right now. Message the team below." };
  const ip = (await clientIp()) ?? "unknown";
  if (!allowed(`visitor:${ip}`, 5, 25) || !allowed("visitors:all", 60, 600)) return { ok: false, error: "That's a lot of questions in a short time. Wait a minute, or message the team below." };
  return answer(VISITOR_SYSTEM, p.data.messages);
}

async function answer(system: string, messages: { role: "user" | "assistant"; text: string }[]): Promise<HelpAnswer> {
  const p = { data: { messages } };
  const transcript = p.data.messages.map((m) => `${m.role === "user" ? "Person" : "Assistant"}: ${m.text}`).join("\n\n");
  const r = await generateJson(system, `Conversation so far:\n\n${transcript}\n\nWrite the assistant's next reply.`, SCHEMA);
  if (!r.ok) return { ok: false, error: r.code === "quota" ? "The assistant is busy right now. Try again in a little while, or send us a request below." : "The assistant couldn't answer just now. Try again, or send us a request below." };
  try {
    const j = JSON.parse(r.text) as { answer?: unknown; suggestRequest?: unknown; topic?: unknown; subject?: unknown };
    const answer = typeof j.answer === "string" ? j.answer.trim().slice(0, 2000) : "";
    if (!answer) throw new Error("empty");
    const topic = (TOPICS as readonly string[]).includes(String(j.topic)) ? (j.topic as (typeof TOPICS)[number]) : "other";
    const subject = typeof j.subject === "string" ? j.subject.trim().slice(0, 200) : "";
    return { ok: true, answer, suggestRequest: j.suggestRequest === true, topic, subject };
  } catch {
    return { ok: false, error: "The assistant couldn't answer just now. Try again, or send us a request below." };
  }
}
