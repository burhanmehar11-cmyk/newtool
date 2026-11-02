import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <section className="container-page flex min-h-[70vh] items-center justify-center py-20">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
          <LockKeyhole aria-hidden className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-ink">Accounts open with the private beta</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate">
          There are no accounts yet, so there is nothing to sign in to. You can try the full workflow in the interactive demo with sample data, without an account.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/demo">Explore demo</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
