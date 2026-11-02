import { describe, expect, it } from "vitest";
import { classifyDns, EMAIL_SYNTAX } from "@/lib/research/email-check";

describe("free DNS email check", () => {
  it("never reports an address as valid", () => {
    const r = classifyDns({ syntaxOk: true, mx: [{ exchange: "mx.example", priority: 10 }], hasAddress: true });
    expect(r.status).toBe("unknown");
  });
  it("marks domains that can't receive mail as invalid", () => {
    expect(classifyDns({ syntaxOk: true, mx: "none", hasAddress: false }).status).toBe("invalid");
    expect(classifyDns({ syntaxOk: true, mx: [{ exchange: ".", priority: 0 }], hasAddress: true }).status).toBe("invalid");
    expect(classifyDns({ syntaxOk: false, mx: "none", hasAddress: false }).status).toBe("invalid");
  });
  it("treats an A record without MX as unknown, and lookup failures as errors, not verdicts", () => {
    expect(classifyDns({ syntaxOk: true, mx: "none", hasAddress: true }).status).toBe("unknown");
    expect(classifyDns({ syntaxOk: true, mx: "error", hasAddress: false }).status).toBe("error");
    expect(classifyDns({ syntaxOk: true, mx: "none", hasAddress: "error" }).status).toBe("error");
  });
  it("won't call an address invalid when DNS itself is failing", () => {
    expect(classifyDns({ syntaxOk: true, mx: "none", hasAddress: false, resolverHealthy: false }).status).toBe("error");
    expect(classifyDns({ syntaxOk: true, mx: "none", hasAddress: false, resolverHealthy: true }).status).toBe("invalid");
  });

  it("checks syntax", () => {
    expect(EMAIL_SYNTAX.test("hello@riverside.example")).toBe(true);
    for (const bad of ["no-at-sign", "a@b", "a@-bad.example", "a b@x.example"]) expect(EMAIL_SYNTAX.test(bad), bad).toBe(false);
  });
});
