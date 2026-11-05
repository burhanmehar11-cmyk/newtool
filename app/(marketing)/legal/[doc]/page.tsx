import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/config/brand";
import { LEGAL_UPDATED, legalDocs } from "./docs";

export function generateStaticParams() {
  return Object.keys(legalDocs).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  const d = legalDocs[doc];
  return d ? { title: d.title, description: d.intro, alternates: { canonical: `/legal/${doc}` } } : { title: "Not found" };
}

/** Links and email addresses in the text become clickable. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+[^\s).,]|[\w.+-]+@[\w-]+\.[\w.-]+[a-z])/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-green underline underline-offset-2">
            {p}
          </a>
        ) : /@/.test(p) && /^[\w.+-]+@/.test(p) ? (
          <a key={i} href={`mailto:${p}`} className="text-green underline underline-offset-2">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const d = legalDocs[doc];
  if (!d) notFound();
  return (
    <article className="container-page max-w-3xl py-16 sm:py-20">
      <p className="eyebrow text-green">Legal</p>
      <h1 className="mt-3 text-4xl font-bold text-ink">{d.title}</h1>
      <p className="mt-2 text-sm text-slate">
        {brand.name} · Last updated {LEGAL_UPDATED}
      </p>
      <p className="mt-6 text-[16px] leading-7 text-ink">{d.intro}</p>
      {d.sections.length > 6 ? (
        <nav aria-label="Contents" className="mt-8 rounded-xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">Contents</p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {d.sections.map((s, i) => (
              <li key={s.h}>
                <a href={`#s${i}`} className="text-ink hover:text-green">
                  {s.h}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="mt-10 space-y-9">
        {d.sections.map((s, i) => (
          <section key={s.h} id={`s${i}`} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-ink">{s.h}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate">
              {s.p.map((p) => (
                <p key={p}>
                  <Linked text={p} />
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 border-t border-line pt-6 text-sm text-slate">
        See also:{" "}
        {Object.entries(legalDocs)
          .filter(([k]) => k !== doc)
          .map(([k, v], i) => (
            <span key={k}>
              {i ? " · " : ""}
              <Link href={`/legal/${k}`}>{v.title}</Link>
            </span>
          ))}
      </p>
    </article>
  );
}
