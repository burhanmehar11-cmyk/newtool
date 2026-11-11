"use server";

import { revalidatePath } from "next/cache";
import { setWorkspacePlan } from "@/server/services/admin";

export async function setPlanAction(input: { workspaceId: string; plan: string; trialEndsAt: string | null; note: string | null }) {
  const r = await setWorkspacePlan(input);
  if (r.ok) revalidatePath("/admin");
  return r;
}

export async function sendAnnouncementTestAction(input: { template: string | null; subject: string; body: string }) {
  const { sendAnnouncementTest } = await import("@/server/services/announcements");
  return sendAnnouncementTest(input);
}

export async function startAnnouncementAction(input: { template: string | null; subject: string; body: string; confirm: boolean }) {
  const { startAnnouncement } = await import("@/server/services/announcements");
  return startAnnouncement(input);
}

export async function continueAnnouncementAction(id: string) {
  const { continueAnnouncement } = await import("@/server/services/announcements");
  const r = await continueAnnouncement(id);
  if (r.ok && r.done) revalidatePath("/admin");
  return r;
}

export async function stopAnnouncementAction(id: string) {
  const { stopAnnouncement } = await import("@/server/services/announcements");
  const r = await stopAnnouncement(id);
  revalidatePath("/admin");
  return r;
}

export async function sendWelcomeTestAction() {
  const { sendWelcomeTest } = await import("@/server/services/announcements");
  return sendWelcomeTest();
}
