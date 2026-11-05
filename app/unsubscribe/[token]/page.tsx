import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { confirmUnsubscribeAction } from "@/server/actions/unsubscribe";
import { peekUnsubscribe } from "@/server/services/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/**
 * Public page linked from every campaign email. Opening the link doesn't
 * unsubscribe by itself (link scanners open links); the button does, and the
 * one-click header (RFC 8058) posts to /api/unsubscribe/[token].
 */
export default function UnsubscribePage({ params, searchParams }: PageProps<"/unsubscribe/[token]">) {
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

async function Body({ params, searchParams }: Pick<PageProps<"/unsubscribe/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  const sp = await searchParams;
  const email = await peekUnsubscribe(token);
  if (!email) {
    return (
      <>
        <h1 className="font-display text-xl font-semibold text-ink">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm leading-6 text-slate">It may have been copied incompletely. You can also reply to the email and ask not to be contacted again.</p>
      </>
    );
  }
  if (sp.done === "1") {
    return (
      <>
        <h1 className="font-display text-xl font-semibold text-ink">You&apos;re unsubscribed</h1>
        <p className="mt-3 text-sm leading-6 text-slate">
          <span className="font-mono text-ink">{email}</span> won&apos;t receive further emails from this sender.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-xl font-semibold text-ink">Unsubscribe?</h1>
      <p className="mt-3 text-sm leading-6 text-slate">
        Stop emails from this sender to <span className="font-mono text-ink">{email}</span>.
      </p>
      <form action={confirmUnsubscribeAction} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="w-full">
          Unsubscribe
        </Button>
      </form>
      <p className="mt-5 text-xs text-slate">Sent with {brand.name} on behalf of the sender. {brand.name} doesn&apos;t sell or share your address.</p>
    </>
  );
}
