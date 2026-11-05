import { afterEach, describe, expect, it } from "vitest";
import { buildGmailAuthorizeUrl, GMAIL_SEND_SCOPE, hasSendScope } from "@/lib/gmail/oauth";
import { buildMessage, encodeHeaderText, toGmailRaw } from "@/lib/gmail/mime";
import { decryptJson, encryptJson, tokenKey } from "@/server/gmail/crypto";

const decode = (raw: string) => Buffer.from(raw, "base64url").toString("utf8");
const bodyOf = (msg: string) => Buffer.from(msg.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");

describe("Connect Gmail consent URL", () => {
  it("asks for send-only access with a refresh token, PKCE and nonce", () => {
    const u = new URL(buildGmailAuthorizeUrl({ clientId: "cid", redirectUri: "https://app.example/api/gmail/callback", state: "s", nonce: "n", codeChallenge: "c", loginHint: "me@agency.example" }));
    const p = u.searchParams;
    expect(p.get("scope")).toBe(`openid email ${GMAIL_SEND_SCOPE}`);
    expect(p.get("scope")).not.toMatch(/readonly|modify|mail\.google\.com/);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toContain("consent");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("redirect_uri")).toBe("https://app.example/api/gmail/callback");
    expect(p.get("login_hint")).toBe("me@agency.example");
  });

  it("detects when the send box was unticked", () => {
    expect(hasSendScope(`openid ${GMAIL_SEND_SCOPE} https://www.googleapis.com/auth/userinfo.email`)).toBe(true);
    expect(hasSendScope("openid https://www.googleapis.com/auth/userinfo.email")).toBe(false);
    expect(hasSendScope(undefined)).toBe(false);
  });
});

describe("email message for the Gmail API", () => {
  it("builds headers and a base64 UTF-8 body", () => {
    const msg = buildMessage({ from: { email: "sam@agency.example", name: "Sam Lee" }, to: "info@clinic.example", subject: "Quick question", text: "Hi there,\nLine two — ok" });
    expect(msg).toContain('From: "Sam Lee" <sam@agency.example>\r\n');
    expect(msg).toContain("To: info@clinic.example\r\n");
    expect(msg).toContain("Subject: Quick question\r\n");
    expect(msg).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(bodyOf(msg)).toBe("Hi there,\r\nLine two — ok");
  });

  it("encodes non-ASCII subjects and names", () => {
    expect(encodeHeaderText("Café visit")).toBe(`=?UTF-8?B?${Buffer.from("Café visit").toString("base64")}?=`);
    const msg = buildMessage({ from: { email: "a@b.example", name: "Zoë" }, to: "c@d.example", subject: "Olá", text: "x" });
    expect(msg).toMatch(/^From: =\?UTF-8\?B\?.+\?= <a@b\.example>/);
  });

  it("refuses header injection and bad addresses", () => {
    expect(() => buildMessage({ from: { email: "a@b.example" }, to: "c@d.example", subject: "Hi\r\nBcc: x@y.example", text: "x" })).toThrow();
    expect(() => buildMessage({ from: { email: "a@b.example" }, to: "c@d.example\r\nBcc: x@y.example", subject: "Hi", text: "x" })).toThrow();
    expect(() => buildMessage({ from: { email: "a@b.example", name: 'x"\r\n' }, to: "c@d.example", subject: "Hi", text: "x" })).toThrow();
    expect(() => buildMessage({ from: { email: "not-an-email" }, to: "c@d.example", subject: "Hi", text: "x" })).toThrow();
    expect(() => buildMessage({ from: { email: "a@b.example" }, to: "c@d.example", subject: "Hi", text: "x", headers: { "Bad Header": "v" } })).toThrow();
  });

  it("encodes the raw message as base64url", () => {
    const raw = toGmailRaw(buildMessage({ from: { email: "a@b.example" }, to: "c@d.example", subject: "Hi?>>", text: "ÿÿÿ>>>???" }));
    expect(raw).not.toMatch(/[+/=]/);
    expect(decode(raw)).toContain("Subject: Hi?>>");
  });
});

describe("mailbox token encryption", () => {
  const prev = { s: process.env.SESSION_SECRET, k: process.env.TOKEN_ENCRYPTION_KEY };
  afterEach(() => {
    process.env.SESSION_SECRET = prev.s;
    process.env.TOKEN_ENCRYPTION_KEY = prev.k;
  });

  it("round-trips and rejects tampering or the wrong key", () => {
    process.env.SESSION_SECRET = "s".repeat(40);
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const key = tokenKey()!;
    expect(key).toHaveLength(32);
    const blob = encryptJson({ refreshToken: "1//secret" }, key);
    expect(blob.toString("utf8")).not.toContain("1//secret");
    expect(decryptJson(blob, key)).toEqual({ refreshToken: "1//secret" });
    const bad = Buffer.from(blob);
    bad[bad.length - 1] ^= 1;
    expect(decryptJson(bad, key)).toBeNull();
    process.env.SESSION_SECRET = "t".repeat(40);
    expect(decryptJson(blob, tokenKey()!)).toBeNull();
  });

  it("uses TOKEN_ENCRYPTION_KEY when set, and rejects a wrong-length key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(tokenKey()).toEqual(Buffer.alloc(32, 7));
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(tokenKey()).toBeNull();
  });
});

describe("Gmail OAuth client choice", () => {
  const keys = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

  it("uses the Gmail client when both values are set, else the sign-in client", async () => {
    const { gmailOAuth } = await import("@/server/env");
    process.env.GOOGLE_OAUTH_CLIENT_ID = "signin-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "signin-secret";
    delete process.env.GMAIL_OAUTH_CLIENT_ID;
    delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
    expect(gmailOAuth()).toEqual({ clientId: "signin-id", clientSecret: "signin-secret" });
    process.env.GMAIL_OAUTH_CLIENT_ID = "gmail-id";
    expect(gmailOAuth()?.clientId).toBe("signin-id"); // a half-set Gmail client is ignored
    process.env.GMAIL_OAUTH_CLIENT_SECRET = "gmail-secret";
    expect(gmailOAuth()).toEqual({ clientId: "gmail-id", clientSecret: "gmail-secret" });
  });
});
