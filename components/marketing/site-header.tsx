"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetCloseButton, SheetContent } from "@/components/ui/sheet";

export const marketingNav = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#agencies", label: "For agencies" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  // Close the menu if this page is hidden by a navigation.
  React.useLayoutEffect(() => () => setOpen(false), []);

  return (
    <header className="site-header on-dark sticky top-0 z-40 border-b border-white/[0.08] bg-midnight transition-shadow duration-300">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-mint focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-midnight"
      >
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center gap-6">
        <Link href="/" className="rounded-md" aria-label="Locenti home">
          <Logo tone="dark" />
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {marketingNav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-white/75 transition-colors duration-200 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/sign-in" className="hidden rounded-lg px-3 py-2 text-sm text-white/75 transition-colors duration-200 hover:text-white sm:inline-flex">
            Sign in
          </Link>
          <Button asChild variant="mint" size="sm" className="hidden h-9 px-4 sm:inline-flex">
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost-dark" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu aria-hidden className="size-5" />
              </Button>
            </DialogTrigger>
            <SheetContent title="Menu" dark side="right" className="max-w-[320px]">
              <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5">
                <Logo tone="dark" />
                <SheetCloseButton dark />
              </div>
              <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
                {marketingNav.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base text-white/85 hover:bg-white/[0.06] hover:text-white">
                    {n.label}
                  </Link>
                ))}
                <Link href="/sign-in" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base text-white/85 hover:bg-white/[0.06] hover:text-white">
                  Sign in
                </Link>
              </nav>
              <div className="mt-auto border-t border-white/[0.08] p-5">
                <Button asChild variant="mint" size="lg" className="w-full">
                  <Link href="/sign-up" onClick={() => setOpen(false)}>
                    Get started
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Dialog>
        </div>
      </div>
      <div aria-hidden className="scroll-progress absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-mint/0 via-mint to-mint" />
    </header>
  );
}
