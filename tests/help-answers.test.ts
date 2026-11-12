import { describe, expect, it } from "vitest";
import { HELP_STARTERS } from "@/features/support/use-help-chat";
import { instantAnswers, matchAnswer, normalize } from "@/lib/help-answers";

/** Instant answers: common questions are answered at once from the help content, without the AI. */

const app = instantAnswers("app");
const site = instantAnswers("site");
const id = (q: string, set = app, strict = true) => matchAnswer(q, set, { strict })?.id ?? null;

describe("instant answers", () => {
  it("answers every suggested question instantly", () => {
    for (const q of HELP_STARTERS) expect(id(q), q).not.toBeNull();
    for (const q of ["What does Locenti do?", "How does the free trial work?", "Does it send from my own Gmail?", "Where do the emails come from?"]) expect(id(q, site), q).not.toBeNull();
  });

  it("recognises common questions asked in different words", () => {
    expect(id("how can i connect gmail")).toBe("connect-gmail");
    expect(id("My mailbox keeps disconnecting")).toBe("mailbox-reconnect");
    expect(id("why is my campaign not sending?")).toBe("campaign-paused");
    expect(id("How do I invite my team?")).toBe("invite-team");
    expect(id("how to export leads to csv")).toBe("csv");
    expect(id("What's the daily sending limit?")).toBe("send-limits");
    expect(id("I want to talk to a real person")).toBe("contact");
    expect(id("how much does it cost", site)).toBe("price");
    expect(id("what is locenti", site)).toBe("what-is");
    expect(id("is it GDPR compliant?", site)).toBe("compliance");
    expect(id("how do I sign up", site)).toBe("get-started");
  });

  it("leaves unclear or specific questions to the AI", () => {
    expect(id("Can I target dentists in Leeds with a 4.5 rating?")).toBeNull();
    expect(id("is it free?", site)).toBeNull(); // one weak word: let the AI answer properly
    expect(id("hello")).toBeNull();
    expect(id("I have a long question about my campaign that paused yesterday and also I want to know about follow ups and replies and csv files and more")).toBeNull();
  });

  it("any match will do when the AI is unavailable", () => {
    expect(id("is it free?", site, false)).toBe("price");
    expect(id("hello", app, false)).toBeNull();
  });

  it("keeps site answers for visitors and app answers in the app", () => {
    expect(site.some((a) => a.id === "connect-gmail")).toBe(false);
    expect(app.some((a) => a.id === "get-started")).toBe(false);
    for (const a of [...site, ...app]) expect(a.text.length, a.id).toBeGreaterThan(40);
  });

  it("normalises spelling and plurals", () => {
    expect(normalize("E-mails & Campaigns!")).toBe("email campaign");
    expect(normalize("What’s new?")).toBe("what new");
  });
});
