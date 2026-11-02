import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/** Only public marketing pages. Demo, sign-in, draft legal pages and the brand guide are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${brand.siteUrl}/`, changeFrequency: "weekly", priority: 1 }];
}
