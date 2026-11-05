/**
 * Central brand configuration.
 *
 * "Locenti" is a provisional working name. Domain and trademark availability
 * have NOT been checked. Change the values here and re-run `npm run brand`
 * to regenerate the wordmark SVGs.
 */
export const brand = {
  name: "Locenti",
  /** Short descriptor used in titles and metadata. */
  category: "Local prospecting and outreach workspace",
  tagline: "Find the right local businesses. Start better conversations.",
  description:
    "Discover local businesses that fit your offer, understand the opportunity with source-backed research, and turn it into personal outreach.",
  /**
   * Public site URL. Used for canonical URLs, sitemap and social previews.
   * Override with NEXT_PUBLIC_SITE_URL in each environment.
   */
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  /** Placeholder support address on a reserved example domain until the owner sets one. */
  supportEmail: "support@locenti.example",
  /** Legal entity is intentionally unset; legal pages show an owner-review notice. */
  legalEntity: null as string | null,
  /** Static to keep pages prerenderable; update yearly. */
  copyrightYear: 2026,
  logo: {
    icon: "/brand/locentio-icon.svg",
    iconTile: "/brand/locentio-icon-tile.svg",
    wordmarkDark: "/brand/locentio-wordmark-on-dark.svg",
    wordmarkLight: "/brand/locentio-wordmark-on-light.svg",
  },
  social: {
    // No social accounts exist yet. Add handles here when they do.
  },
} as const;

export type Brand = typeof brand;
