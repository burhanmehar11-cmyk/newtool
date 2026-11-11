import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeCard } from "@/features/updates/unsubscribe-card";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/** The short unsubscribe link at the bottom of product emails: locenti.com/u/…. */
export default function ShortUnsubscribePage({ params, searchParams }: PageProps<"/u/[token]">) {
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

async function Body({ params, searchParams }: Pick<PageProps<"/u/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  const sp = await searchParams;
  return <UnsubscribeCard token={token} done={sp.done === "1"} path={`/u/${token}`} />;
}
