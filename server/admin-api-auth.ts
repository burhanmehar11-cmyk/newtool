import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminEmails } from "@/lib/admin";

/**
 * The private admin API token (ADMIN_API_TOKEN, 32+ characters), sent as
 * "Authorization: Bearer …". Acts as the first owner in ADMIN_EMAILS.
 * Used only by /api/admin/announcements and /api/admin/support.
 */
export function adminApiActor(request: NextRequest): { email: string } | null {
  const expected = process.env.ADMIN_API_TOKEN?.trim() ?? "";
  const owner = adminEmails()[0];
  if (expected.length < 32 || !owner) return null;
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/)?.[1]?.trim() ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? { email: owner } : null;
}
