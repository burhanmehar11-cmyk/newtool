import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_TEMPLATES, firstNameOf, renderAnnouncement } from "@/lib/announcements";

describe("announcement templates", () => {
  it("fills in placeholders and leaves typos visible", () => {
    expect(renderAnnouncement("Hi {{first_name}}, see {{ site }} ({{trial_days}} days). {{frist_name}}", { first_name: "Sam", site: "https://locenti.com", trial_days: 14 })).toBe(
      "Hi Sam, see https://locenti.com (14 days). {{frist_name}}",
    );
  });

  it("finds a friendly first name, or says 'there'", () => {
    expect(firstNameOf("Carla Diaz", "c@x.example")).toBe("Carla");
    expect(firstNameOf(null, "sam.lee@agency.example")).toBe("Sam");
    expect(firstNameOf("", "burhanmehar11@gmail.com")).toBe("there"); // digits: not a name
    expect(firstNameOf(null, "info@shop.example")).toBe("Info");
    expect(firstNameOf(null, "x@shop.example")).toBe("there");
  });

  it("only uses known placeholders and has the basics", () => {
    for (const t of ANNOUNCEMENT_TEMPLATES) {
      expect(t.subject.length).toBeLessThanOrEqual(200);
      expect([...`${t.subject} ${t.body}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).every((k) => ["first_name", "site", "trial_days"].includes(k))).toBe(true);
      expect(t.body).toContain("{{first_name}}");
    }
  });
});
