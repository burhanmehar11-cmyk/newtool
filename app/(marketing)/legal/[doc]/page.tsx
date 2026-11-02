import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { brand } from "@/config/brand";
import { legalDocs } from "./docs";

export function generateStaticParams() {
  return Object.keys(legalDocs).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  const d = legalDocs[doc];
  return { title: d ? `${d.title} (draft)` : "Not found", robots: { index: false } };
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const d = legalDocs[doc];
  if (!d) notFound();
  return (
    <article className="container-page max-w-3xl py-16 sm:py-20">
      <div role="note" className="flex gap-3 rounded-xl border border-warn-fg/20 bg-warn-bg px-4 py-3.5 text-sm leading-6 text-warn-fg">
        <AlertTriangle aria-hidden className="mt-1 size-4 shrink-0" />
        <div>
          <p className="font-semibold">Draft for owner and legal review. Not in effect.</p>
          <p>
            This outline has not been reviewed by a lawyer. Company identity, jurisdiction and contact details are placeholders. It makes no compliance or certification claims.
          </p>
        </div>
      </div>
      <h1 className="mt-10 text-4xl font-bold text-ink">{d.title}</h1>
      <p className="mt-2 text-sm text-slate">
        {brand.name} · Last updated: not yet published
      </p>
      <div className="mt-10 space-y-8">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-xl font-bold text-ink">{s.h}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate">
              {s.p.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
