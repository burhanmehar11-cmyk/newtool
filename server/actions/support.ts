"use server";

import { revalidatePath } from "next/cache";
import * as s from "@/server/services/support";

/* people */
export async function openSupportAction(input: { subject: string; topic: string; urgent: boolean; body: string }) {
  const r = await s.openSupportRequest(input);
  if (r.ok) revalidatePath("/app/support");
  return r;
}
export async function replySupportAction(id: string, body: string) {
  const r = await s.replyToMyTicket(id, body);
  if (r.ok) revalidatePath(`/app/support/${id}`);
  return r;
}
export async function resolveSupportAction(id: string) {
  const r = await s.resolveMyTicket(id);
  revalidatePath(`/app/support/${id}`);
  return r;
}

/* admin */
export async function adminReplySupportAction(id: string, body: string, internal: boolean) {
  const r = await s.adminReplyToTicket(id, body, internal);
  if (r.ok) revalidatePath("/admin");
  return r;
}
export async function adminUpdateSupportAction(id: string, patch: { status?: string; priority?: string; assignToMe?: boolean; unassign?: boolean; topic?: string }) {
  const r = await s.adminUpdateTicket(id, patch);
  revalidatePath("/admin");
  return r;
}
export async function adminFindUsersAction(search: string) {
  return s.findSupportUsers(search);
}
export async function adminStartSupportAction(input: { userId: string; subject: string; body: string }) {
  const r = await s.adminStartConversation(input);
  if (r.ok) revalidatePath("/admin");
  return r;
}
