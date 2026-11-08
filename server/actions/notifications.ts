"use server";

import { revalidatePath } from "next/cache";
import { getUnreadNotificationCount, markRead } from "@/server/services/notifications";

export async function unreadNotificationsAction() {
  return getUnreadNotificationCount();
}

export async function markNotificationReadAction(id: string) {
  await markRead(id);
  revalidatePath("/app/notifications");
}

export async function markAllNotificationsReadAction() {
  await markRead();
  revalidatePath("/app/notifications");
}
