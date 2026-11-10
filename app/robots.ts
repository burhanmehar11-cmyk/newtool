import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

/**
 * Public pages (homepage, legal pages, llms.txt) are open to every crawler,
 * search engines and AI search tools alike. "/brand$" blocks only the brand
 * page, not the logo files under /brand/ that search results show.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/demo", "/sign-in", "/sign-up", "/brand$", "/api/", "/app", "/admin", "/invite", "/unsubscribe", "/updates"] }],
    sitemap: `${brand.siteUrl}/sitemap.xml`,
  };
}
