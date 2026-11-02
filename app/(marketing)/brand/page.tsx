import type { Metadata } from "next";
import Image from "next/image";
import { brand } from "@/config/brand";
import { LogoMark } from "@/components/brand/logo";
import { contrastRatio } from "@/lib/contrast";

export const metadata: Metadata = { title: "Brand guide", robots: { index: false } };

const tokens = [
  { name: "Midnight", hex: "#0B1218", use: "Hero, footer, dark surfaces" },
  { name: "Elevated dark", hex: "#13212A", use: "Dark cards and panels" },
  { name: "Mint", hex: "#8FF0C0", use: "Accent and primary CTA on dark" },
  { name: "Deep green", hex: "#12634A", use: "Text and actions on light" },
  { name: "Warm white", hex: "#F6F7F3", use: "Light sections and app canvas" },
  { name: "White", hex: "#FFFFFF", use: "Light cards" },
  { name: "Ink", hex: "#152129", use: "Main text on light" },
  { name: "Slate", hex: "#52636E", use: "Secondary text on light" },
  { name: "Fog", hex: "#93A4AD", use: "Secondary text on dark (added)" },
  { name: "Border", hex: "#DFE6E3", use: "Decorative separators" },
  { name: "Control border", hex: "#7C8D87", use: "Form controls, 3:1 minimum (added)" },
];

const pairs: [string, string, string, string][] = [
  ["Ink", "#152129", "Warm white", "#F6F7F3"],
  ["Slate", "#52636E", "Warm white", "#F6F7F3"],
  ["Slate", "#52636E", "White", "#FFFFFF"],
  ["Deep green", "#12634A", "White", "#FFFFFF"],
  ["White", "#FFFFFF", "Deep green", "#12634A"],
  ["Mint", "#8FF0C0", "Midnight", "#0B1218"],
  ["Midnight", "#0B1218", "Mint", "#8FF0C0"],
  ["Fog", "#93A4AD", "Elevated dark", "#13212A"],
  ["Mint", "#8FF0C0", "White", "#FFFFFF"],
];

export default function BrandPage() {
  return (
    <div className="container-page py-16 sm:py-20">
      <p className="eyebrow text-green">Brand guide</p>
      <h1 className="display-2 mt-4 text-ink">{brand.name}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate">
        Provisional name. Domain and trademark availability have not been checked. The full guide lives in BRAND.md; assets are in /public/brand.
      </p>

      <h2 className="mt-14 text-2xl font-bold text-ink">Mark</h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate">An abstract L, with a location point and one signal arc from its corner. One colour, works from 16px.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="flex items-end gap-5 rounded-[14px] bg-midnight p-6 text-mint">
          {[16, 20, 32, 64].map((s) => (
            <span key={s} style={{ width: s, height: s }} className="inline-flex">
              <LogoMark className="size-full" title={`${s}px`} />
            </span>
          ))}
        </div>
        <div className="flex items-end gap-5 rounded-[14px] border border-line bg-canvas p-6 text-green">
          {[16, 20, 32, 64].map((s) => (
            <span key={s} style={{ width: s, height: s }} className="inline-flex">
              <LogoMark className="size-full" />
            </span>
          ))}
        </div>
        <div className="flex items-end gap-5 rounded-[14px] border border-line bg-surface p-6 text-ink">
          {[16, 20, 32, 64].map((s) => (
            <span key={s} style={{ width: s, height: s }} className="inline-flex">
              <LogoMark className="size-full" />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] bg-midnight p-8">
          <Image src={brand.logo.wordmarkDark} alt={`${brand.name} wordmark on dark`} width={175} height={36} unoptimized />
        </div>
        <div className="rounded-[14px] border border-line bg-surface p-8">
          <Image src={brand.logo.wordmarkLight} alt={`${brand.name} wordmark on light`} width={175} height={36} unoptimized />
        </div>
      </div>

      <h2 className="mt-14 text-2xl font-bold text-ink">Colour</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tokens.map((t) => (
          <div key={t.name} className="card overflow-hidden">
            <div className="h-16 border-b border-line" style={{ background: t.hex }} />
            <div className="p-3">
              <p className="text-sm font-semibold text-ink">{t.name}</p>
              <p className="font-mono text-xs text-slate">{t.hex}</p>
              <p className="mt-1 text-xs text-slate">{t.use}</p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-10 text-lg font-bold text-ink">Measured contrast</h3>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-line text-xs text-slate">
            <tr>
              <th className="px-4 py-2 font-medium">Text</th>
              <th className="px-4 py-2 font-medium">Background</th>
              <th className="px-4 py-2 font-medium">Ratio</th>
              <th className="px-4 py-2 font-medium">Use</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(([a, ah, b, bh]) => {
              const r = contrastRatio(ah, bh);
              return (
                <tr key={a + b} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5">
                    <span className="rounded px-2 py-1 font-medium" style={{ color: ah, background: bh }}>
                      {a}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate">{b}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums">{r.toFixed(2)}:1</td>
                  <td className="px-4 py-2.5 text-slate">{r >= 4.5 ? "Any text" : r >= 3 ? "Large text and UI only" : "Decorative only, never text"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-14 text-2xl font-bold text-ink">Type</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <p className="text-xs text-slate">Manrope · headings</p>
          <p className="mt-3 font-display text-4xl font-bold tracking-tight text-ink">Give them a reason to reply.</p>
        </div>
        <div className="card p-6">
          <p className="text-xs text-slate">Inter · body and interface</p>
          <p className="mt-3 text-[15px] leading-7 text-ink">
            Discover businesses that fit your offer, understand the opportunity, and turn real research into personal outreach.
          </p>
        </div>
      </div>
    </div>
  );
}
