import { describe, expect, it } from "vitest";
import { adminTimeZone, DEFAULT_ADMIN_TIMEZONE } from "@/lib/admin";
import { formatDate, formatDateTime } from "@/lib/utils";

describe("admin time zone", () => {
  it("is Pacific time unless ADMIN_TIMEZONE names a real zone", () => {
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

  it("keeps UTC as the default elsewhere", () => {
    expect(formatDateTime("2026-11-07T17:30:00Z")).toBe("Nov 7, 5:30 PM");
  });
});
