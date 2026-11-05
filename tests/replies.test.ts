import { describe, expect, it } from "vitest";
import { bouncedAddress, classifyReply } from "@/lib/replies/classify";
import { emailOf, htmlToText, parseMessage, stripQuoted } from "@/lib/replies/gmail-thread";
import { hasReadScope, buildGmailAuthorizeUrl, GMAIL_READ_SCOPE } from "@/lib/gmail/oauth";

const enc = (s: string) => Buffer.from(s).toString("base64url");
const r = (text: string, extra: Partial<{ fromEmail: string; subject: string; autoSubmitted: boolean }> = {}) => classifyReply({ fromEmail: "owner@clinic.example", subject: "Re: Online booking", text, autoSubmitted: false, ...extra });

describe("reply classification (suggestions)", () => {
  it("spots interest", () => {
    expect(r("Sounds interesting, can you send more info?").kind).toBe("interested");
    expect(r("Sure, give me a call Tuesday.").kind).toBe("interested");
    expect(r("How much does this cost?").kind).toBe("interested");
  });
  it("spots no, and explicit requests to stop", () => {
    expect(r("No thanks, we're all set.")).toEqual({ kind: "not_interested", stopRequested: false });
    expect(r("Please remove me from your list.")).toEqual({ kind: "not_interested", stopRequested: true });
    expect(r("Unsubscribe")).toEqual({ kind: "not_interested", stopRequested: true });
    expect(r("Stop emailing us.").stopRequested).toBe(true);
  });
  it("spots out-of-office and bounces", () => {
    expect(r("I'm out of the office until Monday.", { subject: "Automatic reply: Online booking" }).kind).toBe("out_of_office");
    expect(r("I am on vacation and will return on the 12th.", { autoSubmitted: true }).kind).toBe("out_of_office");
    expect(r("Address not found", { fromEmail: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification (Failure)" }).kind).toBe("bounce");
    expect(bouncedAddress("Your message to info@clinic.example couldn't be delivered.", ["info@clinic.example"])).toBe("info@clinic.example");
  });
  it("leaves the rest for a person", () => {
    expect(r("Who is this?").kind).toBe("unclassified");
  });
});

describe("Gmail thread parsing", () => {
  it("reads headers and the plain-text part, dropping quoted history", () => {
    const m = parseMessage({
      id: "m1",
      internalDate: "1767225600000",
      payload: {
        mimeType: "multipart/alternative",
        headers: [{ name: "From", value: "Dr Lee <Owner@Clinic.example>" }, { name: "To", value: "sam@agency.example" }, { name: "Subject", value: "Re: Online booking" }],
        parts: [
          { mimeType: "text/plain", body: { data: enc("Yes, let's talk.\n\nOn Tue, Sam <sam@agency.example> wrote:\n> Hi there") } },
          { mimeType: "text/html", body: { data: enc("<p>Yes</p>") } },
        ],
      },
    });
    expect(m).toMatchObject({ id: "m1", fromEmail: "owner@clinic.example", subject: "Re: Online booking", text: "Yes, let's talk.", autoSubmitted: false });
    expect(m?.date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
  it("falls back to HTML converted to text (never stores HTML)", () => {
    const m = parseMessage({ id: "m2", payload: { mimeType: "text/html", headers: [{ name: "Auto-Submitted", value: "auto-replied" }], body: { data: enc("<div>Out of office<br>Back <b>Monday</b><script>x()</script></div>") } } });
    expect(m?.text).toBe("Out of office\nBack Monday");
    expect(m?.autoSubmitted).toBe(true);
  });
  it("helpers", () => {
    expect(emailOf('"A B" <a@b.example>')).toBe("a@b.example");
    expect(htmlToText("<p>a &amp; b</p>")).toBe("a & b");
    expect(stripQuoted("Thanks!\n> old\n> older")).toBe("Thanks!");
  });
});

describe("reply tracking consent", () => {
  it("asks for read access only when turning on reply tracking", () => {
    const base = { clientId: "c", redirectUri: "https://x.example/api/gmail/callback", state: "s", nonce: "n", codeChallenge: "c" };
    expect(new URL(buildGmailAuthorizeUrl(base)).searchParams.get("scope")).not.toContain(GMAIL_READ_SCOPE);
    expect(new URL(buildGmailAuthorizeUrl({ ...base, withReplies: true })).searchParams.get("scope")).toContain(GMAIL_READ_SCOPE);
    expect(hasReadScope(`openid ${GMAIL_READ_SCOPE}`)).toBe(true);
    expect(hasReadScope("openid")).toBe(false);
  });
});
