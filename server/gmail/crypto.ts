import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { sessionSecret } from "@/server/env";

/**
 * Mailbox tokens are encrypted with AES-256-GCM before they reach the
 * database. Key: TOKEN_ENCRYPTION_KEY (32 bytes, base64) if set, otherwise
 * derived from SESSION_SECRET with HKDF. Changing either key makes stored
 * tokens unreadable; affected mailboxes then show "Reconnect".
 *
 * Format: version (1 byte) | IV (12) | auth tag (16) | ciphertext.
 */

const VERSION = 1;

export function tokenKey(): Buffer | null {
  const explicit = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (explicit) {
    const k = Buffer.from(explicit, "base64");
    return k.length === 32 ? k : null;
  }
  const s = sessionSecret();
  return s ? Buffer.from(hkdfSync("sha256", s, "locentio", "mailbox-tokens-v1", 32)) : null;
}

export function encryptJson(value: unknown, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, c.getAuthTag(), ct]);
}

export function decryptJson<T>(blob: Buffer, key: Buffer): T | null {
  try {
    if (blob[0] !== VERSION || blob.length < 30) return null;
    const d = createDecipheriv("aes-256-gcm", key, blob.subarray(1, 13));
    d.setAuthTag(blob.subarray(13, 29));
    return JSON.parse(Buffer.concat([d.update(blob.subarray(29)), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
