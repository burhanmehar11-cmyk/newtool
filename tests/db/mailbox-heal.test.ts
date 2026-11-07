import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Q } from "@/server/auth-store";
import { as, createTestDb, createUser } from "./harness";

/** A mailbox marked "needs reconnecting" is checked with Google before anyone is asked to reconnect. */

const h = vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  return { db: null as unknown as PGlite, refresh: vi.fn() };
});
vi.mock("@/server/db", () => ({ withService: (fn: (q: unknown) => Promise<unknown>) => fn(h.db), withUser: (_u: string, fn: (q: unknown) => Promise<unknown>) => fn(h.db) }));
vi.mock("@/server/gmail/google", () => ({ refreshAccessToken: (...a: unknown[]) => h.refresh(...a), sendRaw: vi.fn(), revokeToken: vi.fn() }));

const { healMailbox } = await import("@/server/services/mailboxes");
const { upsertMailbox, saveSecret, markMailbox } = await import("@/server/mailbox-store");
const { encryptJson, tokenKey } = await import("@/server/gmail/crypto");

const A = "00000000-0000-4000-8000-0000000000c4";
let box: string;
const status = async () => (await h.db.query<{ status: string; last_error: string | null }>("select status, last_error from public.sending_accounts where id = $1", [box])).rows[0];

beforeAll(async () => {
  h.db = await createTestDb();
  const q = h.db as unknown as Q;
  await createUser(h.db, A, "heal@agency.example");
  const ws = await as(h.db, A, async () => (await h.db.query<{ id: string }>("select public.create_workspace('Heal') as id")).rows[0].id);
  box = await as(h.db, A, () => upsertMailbox(q, ws, A, "sales@heal.example", null, "openid gmail.send"));
  await saveSecret(q, box, encryptJson({ refreshToken: "refresh-1", scope: "gmail.send" }, tokenKey()!));
}, 60_000);

describe("rechecking a mailbox marked for reconnecting", () => {
  it("marks it connected again when Google still accepts the grant", async () => {
    await markMailbox(h.db as unknown as Q, box, { status: "needs_reconnect", lastError: "Gmail refused to send (API disabled)" });
    h.refresh.mockResolvedValueOnce({ ok: true, accessToken: "a1", expiresAt: Date.now() + 3600_000 });
    expect(await healMailbox(box)).toBe(true);
    expect(await status()).toEqual({ status: "connected", last_error: null });
  });

  it("keeps asking to reconnect when Google ended the access", async () => {
    await markMailbox(h.db as unknown as Q, box, { status: "needs_reconnect", lastError: "revoked" });
    h.refresh.mockResolvedValueOnce({ ok: false, revoked: true, message: "Google says this mailbox's access was removed or expired. Reconnect it." });
    expect(await healMailbox(box)).toBe(false);
    expect((await status()).status).toBe("needs_reconnect");
  });

  it("leaves a disconnected mailbox alone", async () => {
    await markMailbox(h.db as unknown as Q, box, { status: "disconnected" });
    h.refresh.mockClear();
    expect(await healMailbox(box)).toBe(false);
    expect(h.refresh).not.toHaveBeenCalled();
  });
});
