import { beforeEach, describe, expect, it, vi } from "vitest";

/** The AI help assistant: answers from Locenti's help content, offers a request when it can't help, and is rate limited. */

const h = vi.hoisted(() => ({ gen: vi.fn(), key: "k" as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "u1", email: "a@b.example", sessionId: "s" }) }));
vi.mock("@/server/ai/gemini", () => ({ generateJson: (...a: unknown[]) => h.gen(...a), geminiKey: () => h.key }));

const { askHelpAssistant } = await import("@/server/services/help-assistant");

beforeEach(() => {
  h.gen.mockReset();
  h.key = "k";
});

describe("help assistant", () => {
  it("answers from the help content", async () => {
    h.gen.mockResolvedValue({ ok: true, text: JSON.stringify({ answer: "Open Mailboxes and press Reconnect.", suggestRequest: false, topic: "mailbox", subject: "" }) });
    const r = await askHelpAssistant({ messages: [{ role: "user", text: "My mailbox needs reconnecting" }] });
    expect(r).toEqual({ ok: true, answer: "Open Mailboxes and press Reconnect.", suggestRequest: false, topic: "mailbox", subject: "" });
    const [system, user] = h.gen.mock.calls[0];
    expect(system).toContain("ONLY the facts and help articles below");
    expect(system).toContain("My mailbox says “needs reconnecting”");
    expect(system).toContain("default 25, max 200");
    expect(user).toContain("Person: My mailbox needs reconnecting");
  });

  it("suggests a request when the team should look, and tidies odd output", async () => {
    h.gen.mockResolvedValue({ ok: true, text: JSON.stringify({ answer: "I can't see your account; please ask the team.", suggestRequest: true, topic: "nonsense", subject: "Charged twice" }) });
    expect(await askHelpAssistant({ messages: [{ role: "user", text: "I was charged twice" }] })).toMatchObject({ ok: true, suggestRequest: true, topic: "other", subject: "Charged twice" });
  });

  it("explains itself when it isn't set up or the AI fails", async () => {
    h.key = null;
    expect(await askHelpAssistant({ messages: [{ role: "user", text: "hi" }] })).toMatchObject({ ok: false, error: expect.stringMatching(/isn't available/) });
    h.key = "k";
    h.gen.mockResolvedValue({ ok: false, code: "quota", message: "x" });
    expect(await askHelpAssistant({ messages: [{ role: "user", text: "hi" }] })).toMatchObject({ ok: false, error: expect.stringMatching(/busy/) });
    expect(await askHelpAssistant({ messages: [] })).toMatchObject({ ok: false });
  });

  it("limits how fast one person can ask", async () => {
    h.gen.mockResolvedValue({ ok: true, text: JSON.stringify({ answer: "ok", suggestRequest: false, topic: "other", subject: "" }) });
    const results = [];
    for (let i = 0; i < 8; i++) results.push(await askHelpAssistant({ messages: [{ role: "user", text: `q${i}` }] }));
    expect(results.filter((r) => !r.ok && /a lot of questions/.test(r.error)).length).toBeGreaterThan(0);
  });
});
