import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Consent } from "@/features/oauth/consent";
import { redirectWith, resourceAllowed } from "@/lib/oauth";
import { getCurrentUser, listWorkspaces } from "@/server/auth";
import { authorizeParams, clientLabel, findClient, oauthOrigin } from "@/server/services/oauth";

export const metadata: Metadata = { title: "Connect an app", robots: { index: false, follow: false } };

/**
 * OAuth authorization endpoint: an AI app (ChatGPT, Claude, …) sends the
 * person here; they sign in, pick a workspace and allow or cancel.
 */
export default function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
      <Logo className="h-7" />
      <Suspense fallback={<div className="h-[520px] w-full max-w-md animate-pulse rounded-3xl bg-surface" />}>
        <Authorize searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-float">
      <h1 className="font-display text-lg font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-slate">{text}</p>
    </div>
  );
}

async function Authorize({ searchParams }: { searchParams: PageProps<"/oauth/authorize">["searchParams"] }) {
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  if (flat.error === "invalid") return <Problem title="This connection link isn't valid" text="Start connecting again from the app." />;

  // Without a known app and an exact redirect URI we can't safely send anyone back: show the problem here.
  const client = typeof flat.client_id === "string" ? await findClient(flat.client_id) : null;
  if (!client) return <Problem title="Unknown app" text="This app isn't registered with Locenti. Start connecting again from the app." />;
  if (typeof flat.redirect_uri !== "string" || !client.redirect_uris.includes(flat.redirect_uri)) return <Problem title="This connection link isn't valid" text="The app's return address doesn't match its registration." />;

  const iss = oauthOrigin();
  const p = authorizeParams.safeParse(flat);
  if (!p.success) {
    const msg = p.error.issues[0]?.message ?? "invalid_request";
    redirect(redirectWith(flat.redirect_uri, { error: msg === "unsupported_response_type" ? msg : "invalid_request", error_description: msg, state: typeof flat.state === "string" ? flat.state : undefined, iss }));
  }
  if (!resourceAllowed(p.data.resource, iss)) redirect(redirectWith(flat.redirect_uri, { error: "invalid_target", state: p.data.state, iss }));

  const user = await getCurrentUser();
  if (!user) {
    const here = `/oauth/authorize?${new URLSearchParams(flat as Record<string, string>).toString()}`;
    redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  }
  const workspaces = await listWorkspaces();
  if (!workspaces.length)
    return (
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-float">
        <h1 className="font-display text-lg font-semibold text-ink">Create your workspace first</h1>
        <p className="mt-2 text-sm text-slate">Set up Locenti, then connect {clientLabel(client)} again.</p>
        <Link href="/app/onboarding" className="mt-4 inline-block text-sm font-semibold text-green hover:underline">
          Set up my workspace
        </Link>
      </div>
    );
  let host = "This app";
  try {
    host = new URL(p.data.redirect_uri).hostname;
  } catch {
    /* keep the default */
  }
  return <Consent appName={clientLabel(client)} appHost={host} params={JSON.stringify(p.data)} workspaces={workspaces} email={user.email} />;
}
