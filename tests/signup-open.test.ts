import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ withService: async () => false }));
const { mayUseLocenti } = await import("@/server/access");

describe("who may sign up", () => {
  afterEach(() => {
    delete process.env.SIGNUP_OPEN;
    delete process.env.BETA_ALLOWED_EMAILS;
  });

  it("is closed to strangers by default, open to the beta list", async () => {
    process.env.BETA_ALLOWED_EMAILS = "@agency.example";
    expect(await mayUseLocenti("stranger@gmail.com")).toBe(false);
    expect(await mayUseLocenti("sam@agency.example")).toBe(true);
  });

  it("lets anyone start a free trial with SIGNUP_OPEN=true", async () => {
    process.env.SIGNUP_OPEN = "true";
    expect(await mayUseLocenti("stranger@gmail.com")).toBe(true);
  });
});
