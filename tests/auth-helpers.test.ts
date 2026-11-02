import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";
import { isAllowedBetaEmail } from "@/lib/beta-allowlist";

describe("safeNextPath", () => {
  it.each([
    ["/app/settings?tab=offer", "/app/settings?tab=offer"],
    ["https://evil.example/x", "/app"],
    ["//evil.example", "/app"],
    ["/\\evil.example", "/app"],
    ["javascript:alert(1)", "/app"],
    ["", "/app"],
    [null, "/app"],
  ])("%s → %s", (input, out) => {
    expect(safeNextPath(input as string | null)).toBe(out);
  });
});

describe("beta allowlist", () => {
  const list = "owner@agency.example, @partner.example";
  it("allows exact emails and whole domains, case-insensitively", () => {
    expect(isAllowedBetaEmail("Owner@Agency.example", list)).toBe(true);
    expect(isAllowedBetaEmail("anyone@partner.example", list)).toBe(true);
  });
  it("rejects everything else, and everything when the list is empty", () => {
    expect(isAllowedBetaEmail("other@agency.example", list)).toBe(false);
    expect(isAllowedBetaEmail("x@notpartner.example", list)).toBe(false);
    expect(isAllowedBetaEmail("owner@agency.example", "")).toBe(false);
  });
});
