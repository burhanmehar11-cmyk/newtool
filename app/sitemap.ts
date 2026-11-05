import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** Public marketing and legal pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${brand.siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    ...["privacy", "terms", "acceptable-use"].map((d) => ({ url: `${brand.siteUrl}/legal/${d}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
