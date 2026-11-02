import { CircleCheck, FileSearch, Lightbulb, PencilLine, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { featured } from "./sample-data";

const points = [
  {
    icon: FileSearch,
    title: "Every claim has a source",
    copy: "Each observation links to the page or listing it came from, with the date it was collected.",
  },
  {
    icon: PencilLine,
    title: "You edit before anything is sent",
    copy: "Change the research notes, the angle or the draft. Approval is tied to the exact version you reviewed.",
  },
  {
    icon: ShieldCheck,
    title: "Facts and suggestions look different",
    copy: "Sourced facts are solid. AI suggestions are dashed and labelled, so you always know which is which.",
  },
];

export function Signature() {
  const { business: b, brief, draft } = featured[0];
  const evidence = new Map(b.evidence.map((e) => [e.id, e]));
  const rows = [
    { key: "no_booking", confidence: "High", why: "Stated in the page text" },
    { key: "no_viewport", confidence: "High", why: "Read from the page code" },
    { key: "copyright", confidence: "Low", why: "Sites are often updated without changing the year" },
  ]
    .map(({ key, confidence, why }) => {
      const fact = brief.facts.find((f) => f.id.endsWith(`_f_${key}`));
      if (!fact) return null;
      const opp = brief.opportunities.find((o) => o.basedOnFactIds.includes(fact.id));
      return { fact, ev: evidence.get(fact.evidenceIds[0])!, opp, confidence, why };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  const opening = draft.body.split("\n\n")[1]?.split(". ")[0];

  return (
    <section className="on-dark relative overflow-hidden bg-midnight py-20 text-white sm:py-28">
      <div aria-hidden className="grid-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]" />
      <div className="container-page relative grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
        <div>
          <p className="eyebrow text-mint">Opportunity Briefs</p>
          <h2 className="display-2 mt-4 text-white">Know why you&apos;re reaching out.</h2>
          <p className="mt-5 text-[17px] leading-8 text-white/72">
            Before you write a word, see what was observed, where it came from, and how it relates to what you sell. Missing information stays Unknown. It is never treated as a problem.
          </p>
          <ul className="mt-8 space-y-5">
            {points.map(({ icon: Icon, title, copy }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-mint">
                  <Icon aria-hidden className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-fog">{copy}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-dark min-w-0 self-start overflow-hidden shadow-dark">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-dark px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-fog">Opportunity Brief · web design offer</p>
              <p className="mt-1 font-display text-lg font-bold">{b.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-fog">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-mint" /> Sourced fact
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm border border-dashed border-fog" /> AI suggestion
              </span>
              <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-white/85">Sample data</span>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <caption className="sr-only">Observations, their sources, relevance and confidence</caption>
              <thead className="text-xs text-fog">
                <tr className="border-b border-line-dark">
                  <th scope="col" className="px-5 py-2.5 font-medium">Source</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">Observation</th>
                  <th scope="col" className="py-2.5 pr-4 font-medium">Relevance</th>
                  <th scope="col" className="py-2.5 pr-5 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ fact, ev, opp, confidence, why }) => (
                  <tr key={fact.id} className="border-b border-line-dark align-top last:border-b-0">
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-white">{ev.label}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-fog">{new URL(ev.url).pathname === "/" ? "/ (home)" : new URL(ev.url).pathname}</span>
                      <span className="mt-0.5 block text-[11px] text-fog">{formatDate(ev.collectedAt)}</span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="flex gap-2 text-white">
                        <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-mint" />
                        {fact.text}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="block rounded-md border border-dashed border-white/20 px-2 py-1.5 leading-5 text-white/80">
                        {opp?.relevance ?? "Context only"}
                      </span>
                    </td>
                    <td className="py-3.5 pr-5">
                      <span
                        className={
                          confidence === "High"
                            ? "inline-flex rounded-md bg-mint/15 px-1.5 py-0.5 text-xs font-medium text-mint"
                            : "inline-flex rounded-md bg-white/[0.08] px-1.5 py-0.5 text-xs font-medium text-white/85"
                        }
                      >
                        {confidence}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-fog">{why}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line-dark bg-white/[0.02] px-5 py-4">
            <p className="flex items-center gap-2 text-xs font-medium text-fog">
              <Lightbulb aria-hidden className="size-3.5 text-mint" /> Draft sentence, grounded in the first row
            </p>
            <p className="mt-2 text-[15px] leading-7 text-white">
              “<mark className="rounded bg-mint/20 px-1 text-white">{opening}.</mark>”
            </p>
            <p className="mt-2 text-xs text-fog">
              Overall: {brief.fit.level} fit · {brief.confidence.level} confidence · {brief.confidence.reason}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
