import "server-only";
import { z } from "zod";
import { requireWorkspace } from "@/server/auth";
import type { Q } from "@/server/auth-store";
import { withUser } from "@/server/db";
import { listNotifications, markNotificationsRead, unreadCount } from "@/server/notification-store";

const asQ = <T,>(userId: string, fn: (q: Q) => Promise<T>) => withUser(userId, (q) => fn(q as unknown as Q));

/** Empty (not an error) until migration 0016 has been run. */
export async function getNotifications(filter: "all" | "unread" = "all") {
  const { user, workspace } = await requireWorkspace("/app/notifications");
  try {
    const [items, unread] = await asQ(user.id, async (q) => [await listNotifications(q, workspace.id, { unreadOnly: filter === "unread" }), await unreadCount(q, workspace.id)] as const);
    return { items, unread, ready: true };
  } catch {
    return { items: [], unread: 0, ready: false };
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { user, workspace } = await requireWorkspace("/app");
  try {
    return await asQ(user.id, (q) => unreadCount(q, workspace.id));
  } catch {
    return 0;
  }
}

export async function markRead(id?: string): Promise<number> {
  const { user, workspace } = await requireWorkspace("/app/notifications");
  if (id !== undefined && !z.string().uuid().safeParse(id).success) return 0;
  try {
    return await asQ(user.id, (q) => markNotificationsRead(q, workspace.id, id));
  } catch {
    return 0;
  }
}
