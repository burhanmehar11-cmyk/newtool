import { Hero } from "@/components/marketing/hero";
import { ProofBand } from "@/components/marketing/proof-band";
import { AiSection } from "@/components/marketing/ai-section";
import { ReplyFlow } from "@/components/marketing/reply-flow";
import { AudienceStrip, Workflow } from "@/components/marketing/audience-workflow";
import { ProductTour } from "@/components/marketing/product-tour";
import { Signature } from "@/components/marketing/signature";
import { Capabilities } from "@/components/marketing/capabilities";
import { UseCases } from "@/components/marketing/use-cases";
import { Pricing } from "@/components/marketing/pricing";
import { Faq, FinalCta } from "@/components/marketing/faq";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { homepageJsonLd, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  // Brand first, then what it does: what people see in search results.
  title: { absolute: `${brand.name}: find local businesses on Google Maps and email them` },
  description:
    "Locenti finds local businesses on Google Maps that show a public email, reads their websites, writes a personal first email for each with AI, and sends your approved campaigns from your own Gmail. Free trial.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(homepageJsonLd()) }} />
      <Hero />
      <ProofBand />
      <AudienceStrip />
      <Workflow />
      <AiSection />
      <ProductTour />
      <ReplyFlow />
      <Signature />
      <Capabilities />
      <UseCases />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
