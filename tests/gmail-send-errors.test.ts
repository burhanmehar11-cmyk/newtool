import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRaw } from "@/server/gmail/google";

/** How Gmail's send errors are read: only real access problems ask for a reconnect. */
const reply = (status: number, message: string) => vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ error: { message } }), { status }));
afterEach(() => vi.restoreAllMocks());

describe("Gmail send errors", () => {
  it("treats sending limits as a wait, not a reconnect", async () => {
    reply(403, "User-rate limit exceeded.  Retry after 2026-11-07T10:00:00.000Z");
    expect(await sendRaw("t", "raw")).toMatchObject({ code: "rate_limited" });
    reply(403, "Daily Limit Exceeded");
    expect(await sendRaw("t", "raw")).toMatchObject({ code: "rate_limited" });
    reply(429, "Too many requests");
    expect(await sendRaw("t", "raw")).toMatchObject({ code: "rate_limited" });
  });

  it("keeps the Gmail API being off separate from access problems", async () => {
    reply(403, "Gmail API has not been used in project 123 before or it is disabled.");
    expect(await sendRaw("t", "raw")).toMatchObject({ code: "api_disabled" });
  });

  it("asks for a reconnect only when access itself is refused", async () => {
    reply(401, "Invalid Credentials");
    expect(await sendRaw("t", "raw")).toMatchObject({ code: "auth" });
    reply(403, "Request had insufficient authentication scopes.");
    expect(await sendRaw("t", "raw")).toMatchObject({ code: "permission" });
  });
});
