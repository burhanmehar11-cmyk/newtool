import { brand } from "@/config/brand";
import { faqs } from "@/lib/faq";
import { trialDays } from "@/lib/admin";

/**
 * Structured data (schema.org JSON-LD) for the homepage: who runs the site,
 * what the product is, and the FAQ. Search engines use it for the site name
 * and logo in results, and AI search tools use it to describe Locenti.
 * Everything here must match what the page itself says.
 */
export function homepageJsonLd() {
  const url = `${brand.siteUrl}/`;
  const sameAs = Object.values(brand.social ?? {}).filter((v): v is string => typeof v === "string" && v.startsWith("https://"));
  const org = {
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: brand.name,
    url,
    logo: `${brand.siteUrl}/brand/locentio-logo-512.png`,
    email: brand.supportEmail,
    description: brand.description,
    ...(sameAs.length ? { sameAs } : {}),
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      { "@type": "WebSite", "@id": `${url}#website`, name: brand.name, url, description: brand.tagline, publisher: { "@id": `${url}#organization` }, inLanguage: "en" },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: brand.name,
        url,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Lead generation and cold email outreach",
        operatingSystem: "Web",
        description:
          "Find local businesses on Google Maps that show a public email, see what their websites are missing, let AI write a personal first email for each, and send approved campaigns from your own Gmail.",
        featureList: [
          "Google Maps search by business type and city, through Google's official Places API",
          "Only businesses with a public email on their own website",
          "Website research showing what each business could improve",
          "AI-written first emails based on each business's own website",
          "Campaigns with follow-ups sent from your own Gmail after you approve them",
          "Reply inbox sorted into interested, not interested and out of office",
          "Team workspaces with admin, member and viewer roles",
          "CSV import and export, REST API, webhooks and MCP for AI agents",
        ],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: `${trialDays()}-day free trial, no card needed. Paid plans to be announced.` },
        publisher: { "@id": `${url}#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}

/** JSON-LD as a safe <script> body (no "</script>" can break out). */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
