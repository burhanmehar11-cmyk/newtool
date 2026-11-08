"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, CreditCard, Inbox, LayoutDashboard, LogOut, Mail, Menu, Search, Send, Settings, Users, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetCloseButton, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import { ThemeToggle, useAppTheme } from "@/components/app/theme-toggle";
import { AutoSender } from "@/components/app/auto-sender";
import { ProductTour, TakeTourButton } from "@/features/product/tour";

/**
 * Shell for the live product. Only shipped areas appear in the navigation;
 * Campaigns and Inbox are added as their M2 steps land.
 */
const nav = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/discover", label: "Discover", icon: Search },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/campaigns", label: "Campaigns", icon: Send },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/mailboxes", label: "Mailboxes", icon: Mail },
  { href: "/app/agent", label: "Agent", icon: Bot },
  { href: "/app/team", label: "Team", icon: UsersRound },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function ProductShell({ workspaceSlot, children }: { workspaceSlot: React.ReactNode; children: React.ReactNode }) {
  useAppTheme();
  return (
    <div className="min-h-dvh bg-canvas lg:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-line bg-surface lg:flex" aria-label="Workspace navigation">
        <Sidebar workspaceSlot={workspaceSlot} />
      </aside>
      <MobileBar workspaceSlot={workspaceSlot} />
      <AutoSender />
      {/* Reads the URL, which is request-time data on dynamic routes. */}
      <React.Suspense fallback={null}>
        <ProductTour />
      </React.Suspense>
      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}

function Sidebar({ workspaceSlot, onNavigate }: { workspaceSlot: React.ReactNode; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-16 items-center gap-2 px-5">
        <Link href="/app" className="rounded-md" aria-label="Locenti workspace home" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <div className="mx-3 mb-3">{workspaceSlot}</div>
      {/* The active item depends on the URL, which is request-time data on dynamic routes. */}
      <React.Suspense fallback={<NavLinks pathname={null} onNavigate={onNavigate} />}>
        <ActiveNav onNavigate={onNavigate} />
      </React.Suspense>
      <div className="space-y-3 border-t border-line p-4">
        <TakeTourButton variant="ghost" className="w-full justify-start text-slate" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate">Appearance</span>
          <ThemeToggle />
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-slate">
            <LogOut aria-hidden /> Sign out
          </Button>
        </form>
      </div>
    </>
  );
}

function ActiveNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 px-3" aria-label="Product">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            data-tour={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-200",
              active ? "bg-ink text-white" : "text-slate hover:bg-ink/[0.04] hover:text-ink",
            )}
          >
            <Icon aria-hidden className="size-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileBar({ workspaceSlot }: { workspaceSlot: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  React.useLayoutEffect(() => () => setOpen(false), []);
  return (
    <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <Menu aria-hidden className="size-5" />
          </Button>
        </DialogTrigger>
        <SheetContent title="Navigation" side="left" className="max-w-[280px]">
          <div className="absolute right-3 top-3.5">
            <SheetCloseButton />
          </div>
          <div className="flex h-full flex-col overflow-y-auto">
            <Sidebar workspaceSlot={workspaceSlot} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>
      <Logo />
    </div>
  );
}
