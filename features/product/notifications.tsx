"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, CircleCheck, CircleX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction, unreadNotificationsAction } from "@/server/actions/notifications";
import type { NotificationRow } from "@/server/notification-store";
import { cn } from "@/lib/utils";

const ICON = {
  success: { Icon: CircleCheck, cls: "bg-mint-soft text-green" },
  failed: { Icon: CircleX, cls: "bg-danger-bg text-danger-fg" },
  warning: { Icon: AlertTriangle, cls: "bg-warn-bg text-warn-fg" },
  info: { Icon: Bell, cls: "bg-info-bg text-info-fg" },
} as const;

/** "just now", "5 min ago", "3 h ago", "2 days ago" (worked out on the server, so it renders the same everywhere). */
function ago(s: number) {
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function NotificationItem({ n }: { n: NotificationRow }) {
  const router = useRouter();
  const [, start] = React.useTransition();
  const { Icon, cls } = ICON[n.level] ?? ICON.info;
  const open = () =>
    start(async () => {
      if (!n.read) await markNotificationReadAction(n.id);
      window.dispatchEvent(new Event("locenti:notifications"));
      if (n.href) router.push(n.href);
      else router.refresh();
    });
  return (
    <li className={cn("flex gap-3 px-5 py-4", !n.read && "bg-mint-soft/25")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", cls)}>
        <Icon aria-hidden className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={cn("text-ink", !n.read && "font-semibold")}>{n.title}</span>
          <span className="text-xs text-slate">{ago(n.age_s)}</span>
          {!n.read ? <span className="size-2 rounded-full bg-green" aria-label="Unread" /> : null}
        </p>
        {n.body ? <p className="mt-0.5 text-sm leading-6 text-slate">{n.body}</p> : null}
      </div>
      {n.href || !n.read ? (
        <Button size="sm" variant={n.href ? "secondary" : "ghost"} onClick={open} className="shrink-0 self-center">
          {n.href ? "Open" : "Mark read"}
        </Button>
      ) : null}
    </li>
  );
}

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsReadAction();
          window.dispatchEvent(new Event("locenti:notifications"));
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <CheckCheck aria-hidden />} Mark all as read
    </Button>
  );
}

/** Bell on the workspace card: opens Notifications and shows how many are unread. */
export function NotificationBell({ className }: { className?: string }) {
  const pathname = usePathname();
  const unread = useUnreadNotifications(pathname);
  const active = pathname?.startsWith("/app/notifications");
  return (
    <Link
      href="/app/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      aria-current={active ? "page" : undefined}
      data-tour="/app/notifications"
      className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate transition-colors hover:bg-ink/[0.06] hover:text-ink", active && "bg-ink/[0.06] text-ink", className)}
    >
      <Bell aria-hidden className="size-[18px]" />
      {unread ? (
        <span aria-hidden className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-green px-1 text-center text-[10.5px] font-semibold leading-[18px] text-white ring-2 ring-surface">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/** Unread count for the bell: checked on load, every minute, when the tab comes back, and after reading. */
export function useUnreadNotifications(pathname: string | null) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    const check = () => {
      unreadNotificationsAction()
        .then((n) => alive && setCount(n))
        .catch(() => undefined);
    };
    check();
    const t = setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("locenti:notifications", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("locenti:notifications", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);
  return count;
}
