import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Subtitle + card used by every auth page. */
export function AuthCard({ subtitle, children, footer }: { subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <>
      <p className="mt-2 text-center text-[16px] text-fog">{subtitle}</p>
      <div className="mt-8 w-full max-w-[440px] rounded-[20px] border border-white/[0.09] bg-midnight-2/85 p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-8">
        {children}
      </div>
      {footer ? <div className="mt-6 max-w-[440px] text-center text-[13px] leading-6 text-fog">{footer}</div> : null}
    </>
  );
}

export function LegalNote() {
  return (
    <>
      By continuing, you agree to our{" "}
      <Link href="/legal/terms" className="font-medium text-mint hover:underline">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/legal/privacy" className="font-medium text-mint hover:underline">
        Privacy Policy
      </Link>
      .
    </>
  );
}

/** Shown when this deployment has no sign-in configuration. Never pretends to sign anyone in. */
export function NotConfigured() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl bg-warn-bg px-4 py-3 text-sm leading-6 text-warn-fg">
        <Settings2 aria-hidden className="mt-1 size-4 shrink-0" />
        <p>
          Sign-in isn&apos;t configured in this environment. It needs a Google OAuth client and a database, as described in{" "}
          <code className="font-mono text-[13px]">docs/GOOGLE_CLOUD_SETUP.md</code>.
        </p>
      </div>
      <p className="text-[15px] leading-7 text-fog">You can still try the full workflow in the interactive demo with sample data.</p>
      <Button asChild variant="mint" className="w-full">
        <Link href="/demo">Explore demo</Link>
      </Button>
    </div>
  );
}
