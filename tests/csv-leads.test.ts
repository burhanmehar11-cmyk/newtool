import { describe, expect, it } from "vitest";
import { parseLeadsCsv, splitCsv, toCsv } from "@/lib/csv";

describe("leads CSV", () => {
  it("reads common column names and cleans websites and emails", () => {
    const { rows, errors } = parseLeadsCsv("Business Name,Website,E-mail,Category,City\nRiverbend Dental,riverbend.example/,INFO@Riverbend.example,Dentist,Austin\nNo Contact,,,,\nOnly Email,,hi@only.example,,\n");
    expect(rows).toEqual([
      { line: 2, name: "Riverbend Dental", website: "https://riverbend.example", email: "info@riverbend.example", niche: "Dentist", place: "Austin" },
      { line: 4, name: "Only Email", website: null, email: "hi@only.example", niche: null, place: null },
    ]);
    expect(errors).toEqual(["Line 3: needs a website or a valid email."]);
  });

  it("explains missing columns", () => {
    expect(parseLeadsCsv("website\nx.example").errors[0]).toMatch(/name/);
    expect(parseLeadsCsv("name,phone\nA,1").errors[0]).toMatch(/website" or "email/);
    expect(parseLeadsCsv("").errors[0]).toMatch(/empty/);
  });

  it("writes quoted, formula-safe CSV with a BOM for Excel", () => {
    const csv = toCsv(["Business", "Notes"], [["Acme, Inc", '=HYPERLINK("x")'], ["Plain", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(splitCsv(csv.slice(1))).toEqual([["Business", "Notes"], ["Acme, Inc", "'=HYPERLINK(\"x\")"], ["Plain", ""]]);
  });
});
