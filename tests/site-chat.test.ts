import { beforeEach, describe, expect, it, vi } from "vitest";

/** The website chat for signed-out visitors: a pre-sales AI assistant, and "Talk to the team", which emails the team. */

const h = vi.hoisted(() => ({ gen: vi.fn(), send: vi.fn(), ip: "203.0.113.7" as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "u1" }), requireWorkspace: vi.fn(), getActiveWorkspace: vi.fn() }));
vi.mock("@/server/session", () => ({ clientIp: async () => h.ip }));
vi.mock("@/server/ai/gemini", () => ({ generateJson: (...a: unknown[]) => h.gen(...a), geminiKey: () => "k" }));
vi.mock("@/server/email", () => ({ sendEmail: (...a: unknown[]) => h.send(...a) }));
vi.mock("@/server/admin-access", () => ({ allAdminEmails: async () => ["owner@locenti.example"] }));
vi.mock("@/server/db", () => ({ withService: vi.fn(), withUser: vi.fn() }));
vi.mock("@/server/events", () => ({ track: vi.fn(), notifyWorkspace: vi.fn() }));
vi.mock("@/server/services/admin", () => ({ requireAdmin: vi.fn() }));

const { askVisitorAssistant } = await import("@/server/services/help-assistant");
const { contactTeamFromSite } = await import("@/server/services/support");

beforeEach(() => {
  h.gen.mockReset();
  h.send.mockReset().mockResolvedValue(undefined);
});

describe("website assistant", () => {
  it("answers visitors with the website prompt, without needing an account", async () => {
    h.ip = "198.51.100.1";
    h.gen.mockResolvedValue({ ok: true, text: JSON.stringify({ answer: "Locenti finds local businesses with public emails.", suggestRequest: false, topic: "other", subject: "" }) });
    expect(await askVisitorAssistant({ messages: [{ role: "user", text: "What does Locenti do?" }] })).toMatchObject({ ok: true, answer: expect.stringContaining("local businesses") });
    const [system] = h.gen.mock.calls[0];
    expect(system).toContain("visitor who probably doesn't have an account");
    expect(system).toContain("free trial");
    expect(system).toContain("ONLY the facts");
  });

  it("limits questions per visitor", async () => {
    h.ip = "198.51.100.2";
    h.gen.mockResolvedValue({ ok: true, text: JSON.stringify({ answer: "Hi", suggestRequest: false, topic: "other", subject: "" }) });
    const ask = () => askVisitorAssistant({ messages: [{ role: "user", text: "hi" }] });
    for (let i = 0; i < 5; i++) expect(await ask()).toMatchObject({ ok: true });
    expect(await ask()).toMatchObject({ ok: false, error: expect.stringMatching(/lot of questions/) });
  });
});

describe("website contact form", () => {
  it("emails the team with the visitor as reply-to, and nothing to the visitor", async () => {
    const r = await contactTeamFromSite({ name: "Sam", email: "Sam@Agency.example", message: "Me: Do you offer agency plans?\n\nAssistant: Plans are coming soon." }, "192.0.2.10");
    expect(r).toEqual({ ok: true });
    expect(h.send).toHaveBeenCalledTimes(1);
    const [to, subject, text, opts] = h.send.mock.calls[0];
    expect(to).toBe("owner@locenti.example");
    expect(subject).toBe("[Website chat] Do you offer agency plans?");
    expect(text).toContain("Sam <sam@agency.example>");
    expect(opts.replyTo).toBe("sam@agency.example");
  });

  it("rejects a bad email, quietly drops bots, and limits messages per address", async () => {
    expect(await contactTeamFromSite({ email: "nope", message: "hello" }, "192.0.2.11")).toMatchObject({ ok: false, error: expect.stringMatching(/valid email/) });
    expect(await contactTeamFromSite({ email: "bot@x.example", message: "buy now", website: "http://spam" }, "192.0.2.11")).toEqual({ ok: true });
    expect(h.send).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) expect(await contactTeamFromSite({ email: "a@b.example", message: "hello" }, "192.0.2.12")).toEqual({ ok: true });
    expect(await contactTeamFromSite({ email: "a@b.example", message: "hello" }, "192.0.2.12")).toMatchObject({ ok: false, error: expect.stringMatching(/hello@|email us/) });
  });

  it("says so when the email can't be sent", async () => {
    h.send.mockRejectedValue(new Error("Email is not configured"));
    expect(await contactTeamFromSite({ email: "c@d.example", message: "hello" }, "192.0.2.13")).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't send/) });
  });
});
