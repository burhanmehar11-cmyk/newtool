import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UsersRound } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { AcceptInviteButton } from "@/features/team/accept-invite";
import { AttributionCapture } from "@/components/attribution-capture";
import { getCurrentUser } from "@/server/auth";
import { getInvitePreview } from "@/server/services/team";

export const metadata: Metadata = { title: "Join a workspace", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Opened from an invite link. Joining needs a click while signed in with the invited email. */
export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-16">
      <AttributionCapture />
      <div className="card w-full max-w-md p-7 text-center">
        <Link href="/" className="mx-auto mb-5 flex w-fit items-center gap-2 font-display text-lg font-semibold text-ink">
          <LogoMark className="size-7 text-green" /> {brand.name}
        </Link>
        <Suspense fallback={<p className="text-sm text-slate">Loading…</p>}>
          <Body params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Body({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const [invite, user] = await Promise.all([getInvitePreview(token), getCurrentUser()]);
  const here = `/invite/${token}`;

  if (!invite || invite.status !== "pending") {
    const why = !invite ? "This invite link isn't valid." : invite.status === "expired" ? "This invite has expired." : invite.status === "used" ? "This invite has already been used." : "This invite was withdrawn.";
    return (
      <>
        <h1 className="font-display text-xl font-semibold text-ink">{why}</h1>
        <p className="mt-2 text-sm text-slate">Ask the person who invited you for a new link.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href={user ? "/app" : "/sign-in"}>{user ? "Go to Locenti" : "Sign in"}</Link>
        </Button>
      </>
    );
  }

  const matches = !!user?.email && user.email.toLowerCase() === invite.email;
  return (
    <>
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-mint-soft text-green">
        <UsersRound aria-hidden className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold text-ink">Join {invite.workspaceName}</h1>
      <p className="mt-2 text-sm text-slate">
        You&apos;re invited as {invite.role === "admin" ? "an admin" : invite.role === "viewer" ? "a viewer (read-only)" : "a member"}. The invite is for <span className="font-medium text-ink">{invite.email}</span>.
      </p>
      {!user ? (
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link href={`/sign-in?next=${encodeURIComponent(here)}`}>Sign in to accept</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/sign-up?next=${encodeURIComponent(here)}`}>Create an account</Link>
          </Button>
          <p className="mt-1 text-xs text-slate">Use {invite.email}, with Google or a password.</p>
        </div>
      ) : matches ? (
        <AcceptInviteButton token={token} workspaceName={invite.workspaceName} />
      ) : (
        <div className="mt-6">
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">
            You&apos;re signed in as {user.email ?? "another account"}. Sign out, then sign in with {invite.email}.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/app">Back to Locenti</Link>
          </Button>
        </div>
      )}
    </>
  );
}
