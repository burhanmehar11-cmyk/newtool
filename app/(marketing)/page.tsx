import { Hero } from "@/components/marketing/hero";
import { AudienceStrip, Workflow } from "@/components/marketing/audience-workflow";
import { ProductTour } from "@/components/marketing/product-tour";
import { Signature } from "@/components/marketing/signature";
import { Capabilities } from "@/components/marketing/capabilities";
import { UseCases } from "@/components/marketing/use-cases";
import { Pricing } from "@/components/marketing/pricing";
import { Faq, FinalCta } from "@/components/marketing/faq";

export default function HomePage() {
  return (
    <>
      <Hero />
      <AudienceStrip />
      <Workflow />
      <ProductTour />
      <Signature />
      <Capabilities />
      <UseCases />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
