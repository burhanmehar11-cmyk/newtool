import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, createUser } from "./harness";

/** The welcome email: new confirmed accounts only, exactly once, retried after a failure. */

const h = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://locenti.com";
  return { db: null as unknown as PGlite, send: vi.fn() };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/email", () => ({ sendEmail: (...a: unknown[]) => h.send(...a) }));

const { sendWelcomeEmail } = await import("@/server/services/welcome");
const NEW = "00000000-0000-4000-8000-0000000e0001";
const OLD = "00000000-0000-4000-8000-0000000e0002";
const UNCONFIRMED = "00000000-0000-4000-8000-0000000e0003";

beforeAll(async () => {
  h.db = await createTestDb();
  await createUser(h.db, NEW, "carla.diaz@bakery.example");
  await h.db.query("update auth.users set raw_user_meta_data = '{\"full_name\": \"Carla Diaz\"}' where id = $1", [NEW]);
  await createUser(h.db, OLD, "old@agency.example");
  await h.db.query("update auth.users set created_at = now() - interval '30 days' where id = $1", [OLD]);
  await createUser(h.db, UNCONFIRMED, "pending@shop.example");
  await h.db.query("update auth.users set auth_subject = 'email:x', email_verified_at = null where id = $1", [UNCONFIRMED]);
}, 60_000);

describe("welcome email", () => {
  it("retries at the next sign-in if sending fails", async () => {
    h.send.mockReset().mockRejectedValueOnce(new Error("Gmail is down"));
    expect(await sendWelcomeEmail(NEW)).toBe("failed");
    expect((await h.db.query<{ welcomed_at: string | null }>("select welcomed_at from auth.users where id = $1", [NEW])).rows[0].welcomed_at).toBeNull();
  });

  it("sends a designed email from hello@locenti.com, once", async () => {
    h.send.mockReset().mockResolvedValue(undefined);
    expect(await sendWelcomeEmail(NEW)).toBe("sent");
    expect(await sendWelcomeEmail(NEW)).toBe("skipped"); // second sign-in
    expect(h.send).toHaveBeenCalledTimes(1);
    const [to, subject, text, opts] = h.send.mock.calls[0];
    expect(to).toBe("carla.diaz@bakery.example");
    expect(subject).toBe("Welcome to Locenti, Carla");
    expect(text).toContain("Hi Carla,");
    expect(text).toContain("https://locenti.com/app/mailboxes");
    expect(opts).toMatchObject({ from: "hello@locenti.com", replyTo: "hello@locenti.com", html: expect.stringContaining("Welcome aboard, Carla.") });
    expect(opts.html).toContain('href="https://locenti.com/app"');
    expect(text).not.toMatch(/unsubscribe|You're getting this/i);
  });

  it("never goes to existing accounts or unconfirmed sign-ups", async () => {
    h.send.mockReset();
    expect(await sendWelcomeEmail(OLD)).toBe("skipped");
    expect(await sendWelcomeEmail(UNCONFIRMED)).toBe("skipped");
    expect(h.send).not.toHaveBeenCalled();
  });
});
