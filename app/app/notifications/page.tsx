import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/misc";
import { PageLoading } from "@/features/product/page-loading";
import { MarkAllRead, NotificationItem } from "@/features/product/notifications";
import { getNotifications } from "@/server/services/notifications";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage({ searchParams }: PageProps<"/app/notifications">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Notifications searchParams={searchParams} />
    </Suspense>
  );
}

async function Notifications({ searchParams }: { searchParams: PageProps<"/app/notifications">["searchParams"] }) {
  const sp = await searchParams;
  const filter = sp.show === "unread" ? "unread" : "all";
  const { items, unread, ready } = await getNotifications(filter);
  return (
    <div>
      <PageHeader title="Notifications" description="Replies, campaigns starting and finishing, mailboxes that need attention, team changes and more." actions={unread ? <MarkAllRead /> : null} />
      <SectionCard
        title={unread ? `${unread} unread` : "All caught up"}
        bodyClassName="p-0"
        actions={
          <nav aria-label="Show" className="inline-flex rounded-lg border border-line bg-canvas p-0.5 text-xs font-medium">
            {(["all", "unread"] as const).map((f) => (
              <Link key={f} href={f === "all" ? "/app/notifications" : "/app/notifications?show=unread"} aria-current={filter === f ? "page" : undefined} className={cn("rounded-md px-2.5 py-1", filter === f ? "bg-surface text-ink shadow-sm" : "text-slate hover:text-ink")}>
                {f === "all" ? "All" : "Unread"}
              </Link>
            ))}
          </nav>
        }
      >
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <NotificationItem key={n.id} n={n} />
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState icon={<Bell />} title={filter === "unread" ? "No unread notifications" : "No notifications yet"}>
              {ready ? "You'll see replies, campaign updates and anything that needs your attention here." : "Notifications start once the latest database update (0016_activity_notifications.sql) has been run."}
            </EmptyState>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
