/**
 * Central brand configuration.
 *
 * Change the values here and re-run `npm run brand` to regenerate the
 * wordmark SVGs. Owner and contact details for the legal pages come from
 * NEXT_PUBLIC_* settings so they can be set per deployment (they're public).
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
  /** Public contact address (legal pages, footer). Set NEXT_PUBLIC_CONTACT_EMAIL. */
  supportEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "hello@locenti.com",
  /** Person or company operating the service (legal pages). Set NEXT_PUBLIC_LEGAL_NAME. */
  legalEntity: (process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || "Burhan Javed") as string | null,
  /** Shown on the legal pages next to the operator's name. */
  ownerRole: process.env.NEXT_PUBLIC_LEGAL_ROLE?.trim() || "founder",
  /** Optional postal address and country for the legal pages. */
  businessAddress: (process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || null) as string | null,
  legalCountry: (process.env.NEXT_PUBLIC_LEGAL_COUNTRY?.trim() || null) as string | null,
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
