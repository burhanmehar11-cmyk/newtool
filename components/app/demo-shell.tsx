"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Inbox, LayoutDashboard, LogOut, Megaphone, Menu, RotateCcw, Search, Settings, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogTrigger, SheetCloseButton, SheetContent } from "@/components/ui/sheet";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { demo, useDemo } from "@/demo/store";
import { usageSummary } from "@/demo/selectors";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/demo", label: "Overview", icon: LayoutDashboard },
  { href: "/demo/discover", label: "Discover", icon: Search },
  { href: "/demo/leads", label: "Leads", icon: Users },
  { href: "/demo/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/demo/inbox", label: "Inbox", icon: Inbox },
  { href: "/demo/settings", label: "Settings", icon: Settings },
] as const;

export function DemoShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NoticeBridge />
      <div className="min-h-dvh bg-canvas lg:pl-[240px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-line bg-surface lg:flex lg:flex-col" aria-label="Demo navigation">
          <SidebarContent />
        </aside>
        <DemoBanner />
        <MobileBar />
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

function NoticeBridge() {
  const s = useDemo();
  const { push } = useToast();
  React.useEffect(() => {
    for (const n of s.notices) {
      push({ tone: n.tone, title: n.title, body: n.body });
      demo.consumeNotice(n.id);
    }
  }, [s.notices, push]);
  return null;
}

function DemoBanner() {
  return (
    <div className="sticky top-0 z-20 border-b border-demo-fg/15 bg-demo-bg">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2.5 px-4 py-2 text-[13px] text-demo-fg sm:px-6 lg:px-8">
        <FlaskConical aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Demo workspace.</span>{" "}
          <span className="hidden sm:inline">All businesses are fictional sample data. Nothing is searched, sent or charged.</span>
          <span className="sm:hidden">Sample data. Nothing is sent or charged.</span>
        </p>
        <ResetDemoButton compact />
      </div>
    </div>
  );
}

export function ResetDemoButton({ compact, className }: { compact?: boolean; className?: string }) {
  const [open, setOpen] = React.useState(false);
  React.useLayoutEffect(() => () => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <button type="button" className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:bg-demo-fg/10", className)}>
            <RotateCcw aria-hidden className="size-3.5" /> Reset demo
          </button>
        ) : (
          <Button variant="secondary" size="sm" className={className}>
            <RotateCcw aria-hidden /> Reset demo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Reset the demo" description="This clears everything you changed in this browser. Choose where to start again.">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              demo.reset("sample");
              setOpen(false);
            }}
            className="rounded-xl border border-line p-4 text-left transition-colors duration-200 hover:border-green hover:bg-mint-soft/40"
          >
            <span className="block text-sm font-semibold text-ink">Sample workspace</span>
            <span className="mt-1 block text-[13px] leading-5 text-slate">Saved leads, a running sample campaign and replies to explore.</span>
          </button>
          <button
            type="button"
            onClick={() => {
              demo.reset("empty");
              setOpen(false);
            }}
            className="rounded-xl border border-line p-4 text-left transition-colors duration-200 hover:border-green hover:bg-mint-soft/40"
          >
            <span className="block text-sm font-semibold text-ink">Empty workspace</span>
            <span className="mt-1 block text-[13px] leading-5 text-slate">Start from onboarding with nothing saved.</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const s = useDemo();
  const usage = usageSummary(s);
  const unread = s.threads.filter((t) => t.unread).length;
  const leadCount = Object.keys(s.leads).length;
  return (
    <>
      <div className="flex h-16 items-center gap-2 px-5">
        <Link href="/" className="rounded-md" aria-label="Locentio home" onClick={onNavigate}>
          <Logo />
        </Link>
        <span className="rounded-md bg-demo-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-demo-fg">Demo</span>
      </div>
      <div className="mx-3 mb-3 rounded-[10px] border border-line bg-canvas/70 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-ink">{s.workspace.name}</p>
        <p className="text-xs text-slate">{s.mode === "sample" ? "Sample workspace" : "Empty workspace"}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="App">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/demo" ? pathname === "/demo" : pathname.startsWith(href);
          const count = label === "Leads" ? leadCount : label === "Inbox" ? unread : 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-200",
                active ? "bg-ink text-white" : "text-slate hover:bg-ink/[0.04] hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-[18px]" />
              <span className="flex-1">{label}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "rounded-md px-1.5 text-xs tabular-nums",
                    active ? "bg-white/15 text-white" : label === "Inbox" ? "bg-green text-white" : "bg-ink/[0.06] text-slate",
                  )}
                >
                  {count}
                  {label === "Inbox" ? <span className="sr-only"> unread</span> : null}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-line p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">Demo allowance</p>
        <Meter label="Discovery" used={usage.discovery.used + usage.discovery.reserved} total={usage.discovery.allowance} />
        <Meter label="Verification" used={usage.verification.used} total={usage.verification.allowance} />
        <Meter label="AI" used={usage.ai.used} total={usage.ai.allowance} />
        <div className="flex items-center justify-between pt-1">
          <ResetDemoButton />
          <Link href="/" onClick={onNavigate} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-slate hover:text-ink">
            <LogOut aria-hidden className="size-3.5" /> Exit
          </Link>
        </div>
      </div>
    </>
  );
}

function MobileBar() {
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
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>
      <Logo />
      <span className="rounded-md bg-demo-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-demo-fg">Demo</span>
    </div>
  );
}
