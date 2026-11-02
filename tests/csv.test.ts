import { describe, expect, it } from "vitest";
import { parseCsv, splitCsv, toCsv } from "@/demo/csv";

describe("CSV", () => {
  it("handles quotes, commas and CRLF", () => {
    expect(splitCsv('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });

  it("requires a name and a dedupe key", () => {
    expect(parseCsv("city\nAustin").errors[0]).toMatch(/name/);
    expect(parseCsv("name,city\nA,Austin").errors[0]).toMatch(/website|email/);
  });

  it("reports invalid rows without dropping valid ones", () => {
    const r = parseCsv("name,email\nGood,hi@good.example\n,x@y.example\nBad,not-an-email");
    expect(r.rows.map((x) => x.name)).toEqual(["Good"]);
    expect(r.errors).toHaveLength(2);
  });

  it("neutralises spreadsheet formula injection on export", () => {
    expect(toCsv(["name"], [["=HYPERLINK(\"x\")"]])).toContain("'=HYPERLINK");
  });
});
