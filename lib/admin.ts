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
 * (an IANA name such as "America/New_York"), Pakistan Standard Time by default.
 */
export const DEFAULT_ADMIN_TIMEZONE = "Asia/Karachi";
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

/** Readable names for zones whose browser abbreviation is only an offset ("GMT+5"). */
const ZONE_NAMES: Record<string, { short: string; long: string }> = {
  "Asia/Karachi": { short: "PKT", long: "Pakistan Standard Time" },
  "America/Los_Angeles": { short: "", long: "Pacific time" },
};

/** "PKT", or what the browser calls the zone at that moment ("PST", "EDT", "GMT+1"). */
export function zoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  const fixed = ZONE_NAMES[timeZone]?.short;
  if (fixed) return fixed;
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

export function zoneName(timeZone: string): string {
  return ZONE_NAMES[timeZone]?.long ?? timeZone.replace(/_/g, " ");
}
