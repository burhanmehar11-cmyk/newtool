import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/demo", "/sign-in", "/legal/", "/brand", "/api/"] }],
    sitemap: `${brand.siteUrl}/sitemap.xml`,
  };
}
