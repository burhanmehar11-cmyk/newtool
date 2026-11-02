/**
 * Generates the vector brand assets in public/brand and app/icon.svg.
 *
 *   npm run brand
 *
 * The wordmark text is converted to outlines with opentype.js using the bundled
 * Manrope ExtraBold file, so the SVGs render identically without the font.
 * The mark geometry lives in lib/brand-mark.json and is shared with the React
 * <LogoMark /> component.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import opentype from "opentype.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { brand } = await import(join(root, "config/brand.ts"));
const mark = JSON.parse(await readFile(join(root, "lib/brand-mark.json"), "utf8"));

const MIDNIGHT = "#0B1218";
const MINT = "#8FF0C0";
const INK = "#152129";
const DEEP_GREEN = "#12634A";

function markSvg(color) {
  return mark.paths
    .map((p) =>
      p.type === "circle"
        ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${color}"/>`
        : `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
}

const fontBuf = await readFile(join(root, "assets/fonts/Manrope-800.woff"));
const font = opentype.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

function wordmark({ markColor, textColor }) {
  const fontSize = 30;
  const letterSpacing = -0.02 * fontSize;
  // Lay out glyph by glyph to apply tracking.
  let x = 0;
  const glyphPaths = [];
  const scale = fontSize / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(brand.name);
  glyphs.forEach((g, i) => {
    const p = g.getPath(x, 0, fontSize);
    glyphPaths.push(p.toPathData(2));
    let adv = g.advanceWidth * scale + letterSpacing;
    if (i < glyphs.length - 1) adv += font.getKerningValue(g, glyphs[i + 1]) * scale;
    x += adv;
  });
  const textWidth = x - letterSpacing;
  const capHeight = (font.tables.os2.sCapHeight || 700) * scale;
  const iconSize = 36;
  const gap = 10;
  const height = iconSize;
  const baseline = height / 2 + capHeight / 2;
  const width = Math.ceil(iconSize + gap + textWidth + 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${brand.name}">
<g transform="scale(${iconSize / 32})">${markSvg(markColor)}</g>
<g transform="translate(${iconSize + gap} ${baseline.toFixed(2)})" fill="${textColor}"><path d="${glyphPaths.join(" ")}"/></g>
</svg>
`;
}

const icon = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="${brand.name}">${markSvg(color)}</svg>\n`;

const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="${brand.name}"><rect width="32" height="32" rx="8" fill="${MIDNIGHT}"/><g transform="translate(4 4) scale(0.75)">${markSvg(MINT)}</g></svg>\n`;

await mkdir(join(root, "public/brand"), { recursive: true });
const out = {
  "public/brand/locentra-icon.svg": icon(INK),
  "public/brand/locentra-icon-mint.svg": icon(MINT),
  "public/brand/locentra-icon-green.svg": icon(DEEP_GREEN),
  "public/brand/locentra-icon-tile.svg": tile,
  "public/brand/locentra-wordmark-on-dark.svg": wordmark({ markColor: MINT, textColor: "#FFFFFF" }),
  "public/brand/locentra-wordmark-on-light.svg": wordmark({ markColor: DEEP_GREEN, textColor: INK }),
  "public/brand/locentra-wordmark-mono-black.svg": wordmark({ markColor: "#000000", textColor: "#000000" }),
  "app/icon.svg": tile,
};
for (const [file, content] of Object.entries(out)) {
  await writeFile(join(root, file), content);
  console.log("wrote", file);
}
