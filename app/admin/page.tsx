import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/misc";
import { AdminsTab, ApisTab, EmailsTab, FunnelTab, OverviewTab, RevenueTab, UsageTab, UsersTab, WorkspacesTab } from "@/features/admin/sections";
import { ADMIN_TABS, getAdminTab, type AdminTab } from "@/server/services/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Locenti", robots: { index: false, follow: false } };

const LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  funnel: "Sign-ups & sources",
  users: "People",
  workspaces: "Workspaces & plans",
  usage: "Product usage",
  emails: "Emails",
  apis: "Shared APIs",
  revenue: "Revenue",
  admins: "Admins",
};
const PERIODS = [7, 30, 90];
const WITH_PERIOD: AdminTab[] = ["overview", "funnel", "usage", "emails", "apis", "revenue"];

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-canvas">
      <Suspense fallback={<AdminSkeleton />}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

async function Admin({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const sp = await searchParams;
  const tab: AdminTab = ADMIN_TABS.includes(sp.tab as AdminTab) ? (sp.tab as AdminTab) : "overview";
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const search = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const d = await getAdminTab(tab, days, search);
  const href = (t: AdminTab, dd = days) => `/admin?tab=${t}${WITH_PERIOD.includes(t) ? `&days=${dd}` : ""}`;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-midnight text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <LogoMark className="size-7 text-mint" />
            <span className="font-display text-lg font-semibold">Locenti</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint">
              <ShieldCheck aria-hidden className="size-3.5" /> Admin
            </span>
          </div>
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
            <ArrowLeft aria-hidden className="size-4" /> Back to the app
          </Link>
        </div>
        <nav aria-label="Admin sections" className="mx-auto max-w-[1400px] overflow-x-auto px-2 scrollbar-thin sm:px-4">
          <ul className="flex min-w-max gap-1">
            {ADMIN_TABS.map((t) => (
              <li key={t}>
                <Link
                  href={href(t)}
                  aria-current={t === tab ? "page" : undefined}
                  className={cn("block border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", t === tab ? "border-mint text-white" : "border-transparent text-white/60 hover:text-white")}
                >
                  {LABELS[t]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{LABELS[tab]}</h1>
            <p className="mt-0.5 text-sm text-slate">Live numbers from the database, across every workspace.</p>
          </div>
          {WITH_PERIOD.includes(tab) ? (
            <nav aria-label="Period" className="flex rounded-lg border border-line bg-surface p-0.5">
              {PERIODS.map((p) => (
                <Link key={p} href={href(tab, p)} aria-current={p === days ? "true" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", p === days ? "bg-ink text-white" : "text-slate hover:text-ink")}>
                  {p} days
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        {d.tab === "overview" ? <OverviewTab d={d} days={days} /> : null}
        {d.tab === "funnel" ? <FunnelTab d={d} days={days} /> : null}
        {d.tab === "users" ? <UsersTab d={d} search={search} /> : null}
        {d.tab === "workspaces" ? <WorkspacesTab d={d} search={search} /> : null}
        {d.tab === "usage" ? <UsageTab d={d} days={days} /> : null}
        {d.tab === "emails" ? <EmailsTab d={d} days={days} /> : null}
        {d.tab === "apis" ? <ApisTab d={d} days={days} /> : null}
        {d.tab === "revenue" ? <RevenueTab d={d} days={days} /> : null}
        {d.tab === "admins" ? <AdminsTab d={d} /> : null}
      </main>
    </>
  );
}
