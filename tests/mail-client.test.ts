import { beforeEach, describe, expect, it, vi } from "vitest";

/** The SMTP/IMAP client: errors in plain words, and finding replies (and bounces) to our emails in an inbox. */

const h = vi.hoisted(() => ({ messages: [] as { uid: number; from: string; headers: string; source: string }[], readOnly: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("imapflow", () => ({
  ImapFlow: class {
    async connect() {}
    async getMailboxLock(_p: string, o: unknown) {
      h.readOnly = o;
      return { release() {} };
    }
    async search() {
      return h.messages.map((m) => m.uid);
    }
    async *fetch(uids: number[], query: { source?: boolean }) {
      for (const m of h.messages.filter((x) => uids.includes(x.uid)))
        yield query.source ? { uid: m.uid, source: Buffer.from(m.source) } : { uid: m.uid, headers: Buffer.from(m.headers), envelope: { from: [{ address: m.from, name: "" }] } };
    }
    async logout() {}
    close() {}
  },
}));

const { findReplies, imapProblem, messageIds, smtpProblem } = await import("@/server/mail/client");

const OURS = "<abc-123@agency.example>";
const msg = (uid: number, from: string, extra: string, body: string) => ({
  uid,
  from,
  headers: extra,
  source: `From: ${from}\r\nTo: sam@agency.example\r\nSubject: Re: Quick idea\r\nMessage-ID: <m${uid}@x.example>\r\nDate: Thu, 12 Nov 2026 10:00:00 +0000\r\n${extra}\r\n\r\n${body}\r\n`,
});

beforeEach(() => {
  h.messages = [];
});

describe("finding replies over IMAP", () => {
  it("picks replies and bounces to our emails, skips everything else, and opens the inbox read-only", async () => {
    h.messages = [
      msg(1, "owner@shop.example", `In-Reply-To: ${OURS}\r\nReferences: ${OURS}`, "Yes please, call me.\r\n\r\nOn Tue, Sam wrote:\r\n> Quick idea"),
      msg(2, "friend@other.example", "", "Unrelated newsletter"),
      msg(3, "mailer-daemon@googlemail.com", "", `Delivery to the following recipient failed.\r\n\r\n----- Original message -----\r\nMessage-ID: ${OURS}\r\n`),
      msg(4, "sam@agency.example", `In-Reply-To: ${OURS}`, "my own note"),
      msg(5, "someone@else.example", "In-Reply-To: <not-ours@x.example>", "reply to something else"),
    ];
    const r = await findReplies({ host: "imap.gmail.com", port: 993, secure: true }, { user: "u", pass: "p" }, { since: new Date(0), ours: new Set([OURS]), self: "sam@agency.example" });
    expect(h.readOnly).toEqual({ readOnly: true });
    expect(r.ok).toBe(true);
    const found = r.ok ? r.replies : [];
    expect(found.map((x) => x.id)).toEqual(["<m1@x.example>", "<m3@x.example>"]);
    expect(found[0]).toMatchObject({ fromEmail: "owner@shop.example", text: "Yes please, call me.", refs: [OURS, OURS] });
    expect(found[1].refs).toContain(OURS);
  });

  it("collects Message-IDs from headers, lower-cased", () => {
    expect(messageIds("<A@b.c> <d@E.f>")).toEqual(["<a@b.c>", "<d@e.f>"]);
    expect(messageIds(undefined)).toEqual([]);
  });
});

describe("errors in plain words", () => {
  it("explains a refused App Password, limits and unreachable servers", () => {
    expect(smtpProblem({ code: "EAUTH", responseCode: 535, response: "535-5.7.8 Username and Password not accepted" }, "smtp.gmail.com")).toMatchObject({ code: "auth", message: expect.stringMatching(/App Password/) });
    expect(smtpProblem({ responseCode: 550, response: "550 5.4.5 Daily user sending limit exceeded" }, "smtp.gmail.com")).toMatchObject({ code: "rate_limited" });
    expect(smtpProblem({ code: "ETIMEDOUT", message: "Connection timeout" }, "mail.x.example")).toMatchObject({ code: "network", message: expect.stringMatching(/mail\.x\.example/) });
    expect(smtpProblem({ responseCode: 554, response: "554 Message rejected" }, "mail.x.example")).toMatchObject({ code: "rejected" });
    expect(imapProblem({ responseText: "[ALERT] Your account is not enabled for IMAP use." }, "imap.gmail.com")).toMatchObject({ code: "imap_off", message: expect.stringMatching(/Forwarding and POP\/IMAP/) });
    expect(imapProblem({ authenticationFailed: true }, "imap.zoho.com")).toMatchObject({ code: "auth" });
  });
});
