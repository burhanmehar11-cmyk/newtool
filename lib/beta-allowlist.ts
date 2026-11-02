/**
 * Private-beta sign-up allowlist. BETA_ALLOWED_EMAILS is a comma-separated
 * list of exact emails and/or "@domain" entries. Empty means sign-up is closed.
 */
export function isAllowedBetaEmail(email: string, list: string | undefined = process.env.BETA_ALLOWED_EMAILS): boolean {
  const e = email.trim().toLowerCase();
  const entries = (list ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length || !/^[^@\s]+@[^@\s]+$/.test(e)) return false;
  const domain = e.slice(e.lastIndexOf("@"));
  return entries.some((x) => (x.startsWith("@") ? x === domain : x === e));
}
