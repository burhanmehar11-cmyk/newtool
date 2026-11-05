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

export default function HomePage() {
  return (
    <>
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
