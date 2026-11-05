import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/demo", "/sign-in", "/brand", "/api/", "/app", "/admin", "/invite"] }],
    sitemap: `${brand.siteUrl}/sitemap.xml`,
  };
}
