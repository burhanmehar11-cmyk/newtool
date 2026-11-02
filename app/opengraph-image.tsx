import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import mark from "@/lib/brand-mark.json";
import { brand } from "@/config/brand";

export const alt = `${brand.name}: Find local prospects. Give them a reason to reply.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [bold, regular] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Manrope-800.woff")),
    readFile(join(process.cwd(), "assets/fonts/Inter-400.woff")),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0B1218", padding: 72, color: "#fff", fontFamily: "Inter" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            {mark.paths.map((p, i) =>
              p.type === "circle" ? (
                <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#8FF0C0" />
              ) : (
                <path key={i} d={p.d} fill="none" stroke="#8FF0C0" strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
              ),
            )}
          </svg>
          <span style={{ fontFamily: "Manrope", fontSize: 40, letterSpacing: -1 }}>{brand.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "Manrope", fontSize: 76, lineHeight: 1.05, letterSpacing: -2.5 }}>Find local prospects.</span>
          <span style={{ fontFamily: "Manrope", fontSize: 76, lineHeight: 1.05, letterSpacing: -2.5, color: "#8FF0C0" }}>Give them a reason to reply.</span>
        </div>
        <span style={{ fontSize: 26, color: "#93A4AD" }}>Local prospecting and outreach, with source-backed research.</span>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: bold, weight: 800, style: "normal" },
        { name: "Inter", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
