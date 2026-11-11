import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { confirmUpdatesUnsubscribeAction } from "@/server/actions/updates";
import { peekUpdatesUnsubscribe } from "@/server/services/announcements";

/**
 * Stop-product-emails screen, for the short link (/u/…) and the older long
 * one (/updates/unsubscribe/…). Opening it doesn't unsubscribe by itself
 * (link scanners open links); the button does.
 */
export async function UnsubscribeCard({ token, done, path }: { token: string; done: boolean; path: string }) {
  const email = await peekUpdatesUnsubscribe(token);
  if (!email) {
    return (
      <>
        <h1 className="font-display text-xl font-semibold text-ink">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm leading-6 text-slate">It may have been copied incompletely. You can also reply to the email and ask us to stop.</p>
      </>
    );
  }
  if (done) {
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
        <input type="hidden" name="path" value={path} />
        <Button type="submit" className="w-full">
          Unsubscribe
        </Button>
      </form>
    </>
  );
}
