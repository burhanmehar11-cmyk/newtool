# Brand guide

Working name **Locenti** (provisional; not trademark-checked). A rendered version lives at `/brand` (not indexed).

## Mark

An abstract **L** (the ground and the anchor), a **location point**, and one **signal arc** radiating from the corner. Geometry lives in `lib/brand-mark.json` (32×32 grid) and is shared by the React `<LogoMark />`, the generated SVGs and the social image.

- Works in a single colour at 16–20px. Tested at 16, 20, 24, 32, 64 and 128px.
- On dark: mint mark. On light: deep green or ink.
- Clear space: at least the height of the dot on every side.
- No robot mascot, no AI sparkle as identity, no gradients on the mark.

Assets (`npm run brand` regenerates them; wordmark text is outlined from Manrope ExtraBold):

| File | Use |
| --- | --- |
| `public/brand/locentio-icon.svg` | Mark, ink |
| `public/brand/locentio-icon-mint.svg` / `-green.svg` | Mark on dark / light |
| `public/brand/locentio-icon-tile.svg`, `app/icon.svg` | Favicon and app tile |
| `public/brand/locentio-wordmark-on-dark.svg` / `-on-light.svg` / `-mono-black.svg` | Wordmarks |
| `app/opengraph-image.tsx` | 1200×630 social preview |

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| Midnight | `#0B1218` | Hero, footer, dark surfaces |
| Elevated dark | `#13212A` | Dark cards and panels |
| Mint | `#8FF0C0` | Accent; primary CTA on dark |
| Deep green | `#12634A` | Text and actions on light |
| Warm white | `#F6F7F3` | Light sections, app canvas |
| White | `#FFFFFF` | Light cards |
| Ink | `#152129` | Main text on light |
| Slate | `#52636E` | Secondary text on light |
| Border | `#DFE6E3` | Decorative separators only |
| **Fog** (added) | `#93A4AD` | Secondary text on dark |
| **Control border** (added) | `#7C8D87` | Input borders (≥3:1 on white) |

Measured contrast (enforced by `tests/contrast.test.ts`): ink/warm 15.2, slate/warm 5.8, slate/white 6.2, green/white 7.2, mint/midnight 13.8, fog/midnight 7.3, fog/elevated 6.4. **Mint on white is 1.36:1. Never use it for text on light surfaces**; mint appears there only as a soft tint (`#D9F8E8`) behind green or ink text.

Status colours (warn, danger, info, demo) each pass 4.5:1 for their text-on-tint pairs. Demo labels use a sand tone, distinct from brand mint, so sample data is never mistaken for live data.

## Typography

- **Manrope** for headings (700–800, tight tracking). Hero ≈72px desktop, ≈36–40px mobile via `clamp()`.
- **Inter** for body and interface (400–600, 13–17px).
- Both are bundled locally from Fontsource under the SIL Open Font License (`app/fonts/OFL-*.txt`).

## Layout and motion

- Marketing container ≈1200px. Dark hero and footer, warm-white explanatory sections, occasional dark product highlights.
- 12–16px radii, thin borders, soft shadows. Pills used sparingly.
- Product visuals are real, interactive components, not screenshots.
- Lucide icons only. No emoji as UI.
- Transitions 160–240ms. One slow auto-advancing demo in the hero (paused on hover and focus, off for reduced motion). Everything stays visible without animation.

## Voice

Short, plain, specific. Say what was observed and what it might mean. Never promise results. Label samples as samples and previews as previews.
