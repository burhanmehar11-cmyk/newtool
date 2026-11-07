/** Platform admins: exact emails in ADMIN_EMAILS (comma-separated). Empty means nobody. */
export function adminEmails(list: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (list ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[^@\s]+@[^@\s]+$/.test(x));
}

export function isAdminEmail(email: string | null | undefined, list?: string): boolean {
  return !!email && adminEmails(list).includes(email.trim().toLowerCase());
}

/** Trial length shown in the admin panel (not enforced). */
export function trialDays(v: string | undefined = process.env.TRIAL_DAYS): number {
  const d = Number(v);
  return Number.isInteger(d) && d >= 1 && d <= 90 ? d : 14;
}

/**
 * Time zone for the admin panel's times and per-day charts: ADMIN_TIMEZONE
 * (an IANA name such as "America/New_York"), Pacific time by default.
 */
export const DEFAULT_ADMIN_TIMEZONE = "America/Los_Angeles";
export function adminTimeZone(v: string | undefined = process.env.ADMIN_TIMEZONE): string {
  const tz = v?.trim();
  if (!tz || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return DEFAULT_ADMIN_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_ADMIN_TIMEZONE;
  }
}
