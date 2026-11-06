import { describe, expect, it, vi } from "vitest";

const err = (code: string) => Object.assign(new Error(code), { code });
vi.mock("node:dns", () => ({
  promises: {
    resolveMx: async (d: string) => {
      if (d === "gmail.com" || d === "good.example") return [{ exchange: "mx." + d, priority: 10 }];
      if (d === "flaky.example") throw err("ESERVFAIL");
      throw err("ENOTFOUND");
    },
    resolve4: async () => {
      throw err("ENOTFOUND");
    },
    resolve6: async () => {
      throw err("ENOTFOUND");
    },
  },
}));

const { deliverableEmails } = await import("@/server/research/email-check");

describe("domain check on found emails", () => {
  it("keeps addresses whose domain receives email and drops dead domains", async () => {
    const out = await deliverableEmails([{ email: "info@good.example" }, { email: "hello@dead.example" }, { email: "sales@good.example" }]);
    expect(out.map((x) => x.email)).toEqual(["info@good.example", "sales@good.example"]);
  });

  it("keeps addresses when the lookup itself fails", async () => {
    expect((await deliverableEmails([{ email: "a@flaky.example" }])).map((x) => x.email)).toEqual(["a@flaky.example"]);
  });

  it("handles an empty list", async () => {
    expect(await deliverableEmails([])).toEqual([]);
  });
});
