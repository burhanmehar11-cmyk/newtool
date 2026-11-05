import { describe, expect, it } from "vitest";
import { signatureHeader, verifySignature, webhookUrlProblem } from "@/lib/webhooks";

describe("webhook signatures", () => {
  const secret = "whsec_test_secret";
  const body = '{"event":"reply.received","data":{"label":"interested"}}';

  it("verifies what was signed, and nothing else", () => {
    const h = signatureHeader(secret, body, 1_800_000_000);
    expect(h).toMatch(/^t=1800000000,v1=[a-f0-9]{64}$/);
    expect(verifySignature(secret, body, h, 1_800_000_010)).toBe(true);
    expect(verifySignature(secret, body.replace("interested", "not_interested"), h, 1_800_000_010)).toBe(false);
    expect(verifySignature("whsec_other", body, h, 1_800_000_010)).toBe(false);
    expect(verifySignature(secret, body, "t=1800000000,v1=zz", 1_800_000_010)).toBe(false);
  });

  it("rejects old signatures (replays)", () => {
    const h = signatureHeader(secret, body, 1_800_000_000);
    expect(verifySignature(secret, body, h, 1_800_000_000 + 301)).toBe(false);
  });

  it("only accepts public https URLs", () => {
    expect(webhookUrlProblem("https://hooks.example.com/locenti")).toBeNull();
    expect(webhookUrlProblem("http://hooks.example.com")).toMatch(/https/);
    expect(webhookUrlProblem("https://user:pw@hooks.example.com")).toMatch(/credentials/);
    expect(webhookUrlProblem("https://10.0.0.5/hook")).toMatch(/public host/);
    expect(webhookUrlProblem("https://localhost/hook")).toMatch(/public host/);
    expect(webhookUrlProblem("not a url")).toMatch(/full URL/);
  });
});
