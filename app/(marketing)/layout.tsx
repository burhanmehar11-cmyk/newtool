import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ScrollEffects } from "@/components/marketing/scroll-effects";
import { AttributionCapture } from "@/components/attribution-capture";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <ScrollEffects />
      <AttributionCapture />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
