import { describe, expect, it } from "vitest";
import { adminTimeZone, DEFAULT_ADMIN_TIMEZONE, zoneAbbreviation, zoneName } from "@/lib/admin";
import { formatDate, formatDateTime } from "@/lib/utils";

describe("admin time zone", () => {
  it("is Pakistan Standard Time unless ADMIN_TIMEZONE names a real zone", () => {
    expect(DEFAULT_ADMIN_TIMEZONE).toBe("Asia/Karachi");
    expect(adminTimeZone(undefined)).toBe(DEFAULT_ADMIN_TIMEZONE);
    expect(adminTimeZone("America/New_York")).toBe("America/New_York");
    expect(adminTimeZone("Mars/Olympus")).toBe(DEFAULT_ADMIN_TIMEZONE);
    expect(adminTimeZone("x'; drop table users; --")).toBe(DEFAULT_ADMIN_TIMEZONE);
  });

  it("shows Pacific times with PST in winter and PDT in summer", () => {
    expect(formatDateTime("2026-11-07T17:30:00Z", "America/Los_Angeles", true)).toBe("Nov 7, 9:30 AM PST");
    expect(formatDateTime("2026-07-01T17:30:00Z", "America/Los_Angeles", true)).toBe("Jul 1, 10:30 AM PDT");
    // Late evening in California is already the next day in UTC.
    expect(formatDate("2026-11-08T05:00:00Z", undefined, "America/Los_Angeles")).toBe("Nov 7, 2026");
  });

  it("shows Pakistan times as PKT (UTC+5, no daylight saving)", () => {
    expect(`${formatDateTime("2026-11-07T12:23:00Z", "Asia/Karachi")} ${zoneAbbreviation("Asia/Karachi")}`).toBe("Nov 7, 5:23 PM PKT");
    expect(formatDateTime("2026-07-01T12:23:00Z", "Asia/Karachi")).toBe("Jul 1, 5:23 PM");
    // 8 PM UTC is already the next day in Pakistan.
    expect(formatDate("2026-11-07T20:00:00Z", undefined, "Asia/Karachi")).toBe("Nov 8, 2026");
    expect(zoneName("Asia/Karachi")).toBe("Pakistan Standard Time");
    expect(zoneAbbreviation("America/New_York", new Date("2026-07-01T12:00:00Z"))).toBe("EDT");
  });

  it("keeps UTC as the default elsewhere", () => {
    expect(formatDateTime("2026-11-07T17:30:00Z")).toBe("Nov 7, 5:30 PM");
  });
});
