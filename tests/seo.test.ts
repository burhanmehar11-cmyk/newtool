import { describe, expect, it } from "vitest";
import { homepageJsonLd, jsonLdScript } from "@/lib/seo";
import { faqs } from "@/lib/faq";

describe("homepage structured data", () => {
  const d = homepageJsonLd();
  const byType = (t: string) => d["@graph"].find((x) => x["@type"] === t) as Record<string, unknown>;

  it("describes the company, the website, the product and the FAQ", () => {
    expect(d["@graph"].map((x) => x["@type"])).toEqual(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]);
    expect(byType("Organization")).toMatchObject({ name: "Locenti", logo: expect.stringMatching(/\/brand\/locentio-logo-512\.png$/) });
    expect(byType("SoftwareApplication")).toMatchObject({ applicationCategory: "BusinessApplication", offers: { price: "0", priceCurrency: "USD" } });
  });

  it("gives search engines exactly the FAQ shown on the page", () => {
    const qa = (byType("FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[]).map((q) => [q.name, q.acceptedAnswer.text]);
    expect(qa).toEqual(faqs.map((f) => [f.q, f.a]));
    expect(faqs[0].q).toBe("What is Locenti?");
  });

  it("can't break out of its script tag", () => {
    expect(jsonLdScript({ x: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
