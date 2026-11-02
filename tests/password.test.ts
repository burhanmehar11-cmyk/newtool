import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, newEmailToken, passwordProblem, verifyPassword } from "@/lib/auth/password";

describe("passwords", () => {
  it("hashes with a random salt and verifies only the right password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });

  it("explains weak passwords", () => {
    expect(passwordProblem("short")).toMatch(/10/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/predictable/);
    expect(passwordProblem("a perfectly fine phrase")).toBeNull();
  });

  it("stores only token hashes", () => {
    const t = newEmailToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
  });
});
