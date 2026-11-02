import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

const T = {
  midnight: "#0B1218",
  elevated: "#13212A",
  mint: "#8FF0C0",
  green: "#12634A",
  warm: "#F6F7F3",
  white: "#FFFFFF",
  ink: "#152129",
  slate: "#52636E",
  fog: "#93A4AD",
  lineStrong: "#7C8D87",
  warnFg: "#6B4A00",
  warnBg: "#FFF3D1",
  dangerFg: "#A4231A",
  dangerBg: "#FDECEA",
  infoFg: "#1D4F8F",
  infoBg: "#E7F0FB",
  demoFg: "#5C4300",
  mintSoft: "#D9F8E8",
};

describe("brand token contrast (WCAG 2.x)", () => {
  const text: [string, string][] = [
    ["ink", "warm"],
    ["ink", "white"],
    ["slate", "warm"],
    ["slate", "white"],
    ["green", "white"],
    ["green", "warm"],
    ["green", "mintSoft"],
    ["white", "green"],
    ["mint", "midnight"],
    ["mint", "elevated"],
    ["midnight", "mint"],
    ["white", "midnight"],
    ["fog", "midnight"],
    ["fog", "elevated"],
    ["warnFg", "warnBg"],
    ["dangerFg", "dangerBg"],
    ["infoFg", "infoBg"],
    ["demoFg", "warnBg"],
    ["dangerFg", "white"],
  ];
  it.each(text)("%s on %s meets 4.5:1 for body text", (fg, bg) => {
    expect(contrastRatio(T[fg as keyof typeof T], T[bg as keyof typeof T])).toBeGreaterThanOrEqual(4.5);
  });

  it("form-control borders meet 3:1 against white and warm white", () => {
    expect(contrastRatio(T.lineStrong, T.white)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(T.lineStrong, T.warm)).toBeGreaterThanOrEqual(3);
  });

  it("documents that mint must never be text on white", () => {
    expect(contrastRatio(T.mint, T.white)).toBeLessThan(3);
  });
});
