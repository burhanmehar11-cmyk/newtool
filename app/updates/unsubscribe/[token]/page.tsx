import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { confirmUpdatesUnsubscribeAction } from "@/server/actions/updates";
import { peekUpdatesUnsubscribe } from "@/server/services/announcements";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/**
 * Linked from every product email. Opening it doesn't unsubscribe by itself
 * (link scanners open links); the button does, and mail apps' one-click
 * unsubscribe posts to /api/updates/unsubscribe/[token].
 */
export default function UpdatesUnsubscribePage({ params, searchParams }: PageProps<"/updates/unsubscribe/[token]">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-16">
      <div className="card w-full max-w-md p-7 text-center">
        <Suspense fallback={<p className="text-sm text-slate">Loading…</p>}>
          <Body params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Body({ params, searchParams }: Pick<PageProps<"/updates/unsubscribe/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  const sp = await searchParams;
  const email = await peekUpdatesUnsubscribe(token);
  if (!email) {
    return (
      <>
        <h1 className="font-display text-xl font-semibold text-ink">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm leading-6 text-slate">It may have been copied incompletely. You can also reply to the email and ask us to stop.</p>
      </>
    );
  }
  if (sp.done === "1") {
    return (
      <>
        <h1 className="font-display text-xl font-semibold text-ink">You&apos;re unsubscribed</h1>
        <p className="mt-3 text-sm leading-6 text-slate">
          <span className="font-mono text-ink">{email}</span> won&apos;t get {brand.name} product emails any more. Emails about your account, such as password resets, still arrive.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm font-medium">
          Back to {brand.name}
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-xl font-semibold text-ink">Stop product emails?</h1>
      <p className="mt-3 text-sm leading-6 text-slate">
        No more {brand.name} news and tips to <span className="font-mono text-ink">{email}</span>. Account emails (like password resets) still arrive.
      </p>
      <form action={confirmUpdatesUnsubscribeAction} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="w-full">
          Unsubscribe
        </Button>
      </form>
    </>
  );
}
