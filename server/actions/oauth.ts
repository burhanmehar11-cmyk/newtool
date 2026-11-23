"use server";

import { redirect } from "next/navigation";
import { redirectWith } from "@/lib/oauth";
import { getCurrentUser, listWorkspaces } from "@/server/auth";
import { authorizeParams, clientLabel, findClient, issueCode, oauthOrigin, recordConnected } from "@/server/services/oauth";

/**
 * The person's answer on the consent screen. Everything is checked again
 * here (the form could have been tampered with), then the app gets a
 * one-time code, or "access_denied".
 */
export async function answerAuthorizeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("params") ?? "{}"));
  } catch {
    raw = {};
  }
  const p = authorizeParams.safeParse(raw);
  if (!p.success) redirect("/oauth/authorize?error=invalid");
  const client = await findClient(p.data.client_id);
  if (!client || !client.redirect_uris.includes(p.data.redirect_uri)) redirect("/oauth/authorize?error=invalid");
  const iss = oauthOrigin();
  if (formData.get("decision") !== "allow") redirect(redirectWith(p.data.redirect_uri, { error: "access_denied", error_description: "The person declined.", state: p.data.state, iss }));
  const workspaceId = String(formData.get("workspace") ?? "");
  const ws = (await listWorkspaces()).find((w) => w.id === workspaceId);
  if (!ws) redirect(redirectWith(p.data.redirect_uri, { error: "access_denied", error_description: "No workspace was chosen.", state: p.data.state, iss }));
  const code = await issueCode(p.data, user.id, ws.id);
  await recordConnected(user.id, ws.id, clientLabel(client));
  redirect(redirectWith(p.data.redirect_uri, { code, state: p.data.state, iss }));
}
