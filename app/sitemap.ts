import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** When the public pages last changed meaningfully (update with them). */
const UPDATED = new Date("2026-11-09");

/** Public marketing and legal pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${brand.siteUrl}/`, lastModified: UPDATED, changeFrequency: "weekly", priority: 1 },
    ...["privacy", "terms", "acceptable-use"].map((d) => ({ url: `${brand.siteUrl}/legal/${d}`, lastModified: UPDATED, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
