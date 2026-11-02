import Link from "next/link";
import { LockKeyhole, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="card w-full max-w-md p-7 sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
          <LockKeyhole aria-hidden className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-ink">{title}</h1>
        {description ? <p className="mt-2 text-[15px] leading-7 text-slate">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

/** Shown when this deployment has no Supabase configuration. Never pretends to sign anyone in. */
export function NotConfigured() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl bg-warn-bg px-4 py-3 text-sm leading-6 text-warn-fg">
        <Settings2 aria-hidden className="mt-1 size-4 shrink-0" />
        <p>
          Accounts aren&apos;t configured in this environment. The private beta needs <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      </div>
      <p className="text-[15px] leading-7 text-slate">You can still try the full workflow in the interactive demo with sample data.</p>
      <Button asChild className="w-full">
        <Link href="/demo">Explore demo</Link>
      </Button>
    </div>
  );
}
