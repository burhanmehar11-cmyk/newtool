import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { AttributionCapture } from "@/components/attribution-capture";

/** Full-screen layout for sign-in, sign-up and password pages. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="on-dark relative flex min-h-dvh flex-col overflow-hidden bg-midnight text-white">
      <AttributionCapture />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[560px] w-[960px] -translate-x-1/2 rounded-full bg-mint/[0.09] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[420px] w-[520px] rounded-full bg-green/30 blur-3xl" />
        <div className="absolute -right-40 bottom-10 h-[360px] w-[460px] rounded-full bg-mint/[0.05] blur-3xl" />
        <div className="grid-dots absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_35%,black,transparent)]" />
      </div>

      <header className="relative px-5 pt-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-fog transition-colors duration-200 hover:text-white">
          <ArrowLeft aria-hidden className="size-4" /> Back to site
        </Link>
      </header>

      <main id="main" className="relative flex flex-1 flex-col items-center px-4 pb-14 pt-6 sm:pt-10">
        <Link href="/" aria-label={`${brand.name} home`} className="group flex flex-col items-center rounded-2xl">
          <span className="relative flex size-[76px] items-center justify-center rounded-[22px] border border-mint/25 bg-midnight-2 shadow-[0_0_60px_-10px_rgb(143_240_192/0.55)] transition-transform duration-300 group-hover:scale-[1.03]">
            <LogoMark className="size-11 text-mint" />
          </span>
          <span className="mt-5 font-display text-[34px] font-extrabold tracking-[-0.03em] text-white">{brand.name}</span>
        </Link>
        {children}
      </main>
    </div>
  );
}
