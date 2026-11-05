/**
 * Sending windows. A campaign sends only on the chosen weekdays, between the
 * start and end hour, in the campaign's time zone.
 */

export type Schedule = { timezone: string; days: number[]; startHour: number; endHour: number };

export const DEFAULT_SCHEDULE: Schedule = { timezone: "America/New_York", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 };

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Weekday (0 = Sunday), hour and calendar date in a time zone. */
export function localParts(now: Date, timezone: string): { weekday: number; hour: number; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { weekday, hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

export function inSendingWindow(now: Date, s: Schedule): boolean {
  // A malformed schedule never sends.
  if (!s || !Array.isArray(s.days) || !isValidTimezone(s.timezone ?? "")) return false;
  const { weekday, hour } = localParts(now, s.timezone);
  return s.days.includes(weekday) && hour >= s.startHour && hour < s.endHour;
}

export function describeSchedule(s: Schedule) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d)) ? "Mon–Fri" : s.days.map((d) => names[d]).join(", ");
  return `${days}, ${String(s.startHour).padStart(2, "0")}:00–${String(s.endHour).padStart(2, "0")}:00 (${s.timezone.replace(/_/g, " ")})`;
}
