/**
 * Sending pace for each mailbox, so campaigns go out the way a person would
 * send them: never at a fixed rhythm, and spread over the day instead of in
 * one burst.
 */

/** Shortest and longest wait between two emails from the same mailbox. */
export const MIN_GAP_MS = 3 * 60_000;
export const MAX_GAP_MS = 9 * 60_000;

/** FNV-1a: a small, stable hash, so the same email always gets the same wait. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * How long to wait after the mailbox's last email: somewhere between 3 and 9
 * minutes, different after every email. It's derived from that email's send
 * time, so every sending pass agrees on it (no state to store).
 */
export function gapAfter(accountId: string, lastAt: string | Date): number {
  const t = new Date(lastAt).toISOString();
  return MIN_GAP_MS + Math.floor((hash(`${accountId}|${t}`) / 0xffffffff) * (MAX_GAP_MS - MIN_GAP_MS));
}

/**
 * Most emails a mailbox sends in any hour: a third of its daily limit
 * (at least 3, at most 15), so a day's emails are spread over several hours.
 */
export function hourlyCap(dailyCap: number) {
  return Math.min(15, Math.max(3, Math.ceil(dailyCap / 3)));
}
