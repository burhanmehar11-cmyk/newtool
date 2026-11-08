"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, CircleCheck, Compass, Inbox, MessageSquareReply, PenLine, Search, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { EvidenceItem } from "@/components/product/evidence";
import { AiSuggestionBadge, FitBadge, SampleBadge } from "@/components/product/badges";
import type { Tone } from "@/lib/domain/types";
import { draftFor, featured } from "./sample-data";

const tabs = [
  {
    value: "find",
    label: "Find prospects",
    icon: Search,
    title: "Search in plain words. Check the filters before you spend anything.",
    copy: "Your request becomes structured filters you can edit. You see the maximum usage before a search runs, and results arrive page by page.",
  },
  {
    value: "review",
    label: "Review opportunities",
    icon: Compass,
    title: "Every lead comes with its evidence.",
    copy: "Open any observation to see the captured source, its URL and when it was collected. Anything that couldn't be checked is marked Unknown.",
  },
  {
    value: "write",
    label: "Write outreach",
    icon: PenLine,
    title: "Drafts that start from what you actually saw.",
    copy: "Pick a lead and a tone. The opening line is tied to a specific fact, and you edit and approve every version before it can be sent.",
  },
  {
    value: "replies",
    label: "Handle replies",
    icon: MessageSquareReply,
    title: "Replies sorted for you. Answers written by you.",
    copy: "Replies are classified as interested, not interested or out-of-office. You can change the label, and suggested answers stay drafts until you send them.",
  },
] as const;

export function ProductTour() {
  const [tab, setTab] = React.useState<string>("find");
  const active = tabs.find((t) => t.value === tab)!;
  return (
    <section id="product" className="border-y border-line bg-surface py-20 sm:py-28">
      <div className="container-page">
        <div data-reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow text-green">Product</p>
            <h2 className="display-2 mt-4 text-ink">Try the workflow right here.</h2>
          </div>
          <p className="max-w-sm text-[15px] leading-7 text-slate">Everything below is interactive and uses fictional sample businesses.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-10" data-reveal="scale">
          <div className="-mx-5 overflow-x-auto px-5 pb-1 scrollbar-thin md:mx-0 md:px-0">
            <TabsList aria-label="Product areas">
              {tabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="h-9 px-3.5">
                  <Icon aria-hidden /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
            <div key={active.value} className="animate-fade-up lg:pt-4">
              <h3 className="text-2xl font-bold leading-tight text-ink">{active.title}</h3>
              <p className="mt-4 text-[15px] leading-7 text-slate">{active.copy}</p>
              <Button asChild variant="secondary" className="mt-6">
                <Link href="/sign-up">
                  Try it in your workspace <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="min-w-0 rounded-[16px] border border-line bg-canvas p-3 sm:p-4">
              <TabsContent value="find">
                <FindPanel />
              </TabsContent>
              <TabsContent value="review">
                <ReviewPanel />
              </TabsContent>
              <TabsContent value="write">
                <WritePanel />
              </TabsContent>
              <TabsContent value="replies">
                <RepliesPanel />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </section>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <div className="min-w-0 text-[13px] font-medium text-ink">{children}</div>
      <SampleBadge />
    </div>
  );
}

function FindPanel() {
  const [hasSite, setHasSite] = React.useState(true);
  const [minReviews, setMinReviews] = React.useState(true);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [saved, setSaved] = React.useState(false);
  const rows = featured.filter((f) => (!hasSite || f.business.website) && (!minReviews || (f.business.reviewCount ?? 0) >= 30));
  const chip = (on: boolean, label: string, toggle: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium transition-colors duration-200",
        on ? "border-green bg-mint-soft text-green" : "border-line-strong/50 bg-surface text-slate hover:text-ink",
      )}
    >
      {on ? <Check aria-hidden className="size-3.5" /> : null}
      {label}
    </button>
  );
  return (
    <div>
      <PanelHeader>
        <span className="text-slate">Request:</span> dental clinics in Austin with a website and 30+ reviews
      </PanelHeader>
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Dental clinic</Badge>
          <Badge tone="neutral">Austin, TX</Badge>
          {chip(hasSite, "Has website", () => setHasSite((v) => !v))}
          {chip(minReviews, "30+ reviews", () => setMinReviews((v) => !v))}
          <span className="ml-auto text-xs text-slate">Max usage: 25 units</span>
        </div>
      </div>
      <div className="card mt-3 overflow-hidden">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Sample search results</caption>
          <thead className="border-b border-line bg-canvas/60 text-xs text-slate">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">Business</th>
              <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">Rating</th>
              <th scope="col" className="py-2 pr-3 font-medium">Website</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const id = f.business.id;
              const on = selected.includes(id);
              return (
                <tr key={id} className={cn("border-b border-line last:border-b-0", on && "bg-mint-soft/40")}>
                  <td className="px-3 py-2.5">
                    <Checkbox
                      aria-label={`Select ${f.business.name}`}
                      checked={on}
                      onChange={() => {
                        setSaved(false);
                        setSelected((xs) => (on ? xs.filter((x) => x !== id) : [...xs, id]));
                      }}
                    />
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-ink">{f.business.name}</td>
                  <td className="hidden py-2.5 pr-3 text-slate sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <Star aria-hidden className="size-3 fill-current text-warn-fg" />
                      {f.business.rating?.toFixed(1)} · {f.business.reviewCount}
                    </span>
                  </td>
                  <td className="max-w-[140px] truncate py-2.5 pr-3 font-mono text-xs text-slate">{f.business.domain ?? "None listed"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 px-1">
        <Button size="sm" disabled={!selected.length} onClick={() => setSaved(true)}>
          Save {selected.length || ""} to a list
        </Button>
        <p className="text-[13px] text-slate" aria-live="polite">
          {saved ? (
            <>
              Preview only. <Link href="/sign-up" className="font-medium text-green underline underline-offset-2">Start a free trial</Link> to run real searches and save leads.
            </>
          ) : selected.length ? (
            `${selected.length} selected`
          ) : (
            "Select businesses to save them."
          )}
        </p>
      </div>
    </div>
  );
}

function LeadPicker({ value, onChange, count = 3 }: { value: number; onChange: (i: number) => void; count?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Choose a sample lead">
      {featured.slice(0, count).map((f, i) => (
        <button
          key={f.business.id}
          type="button"
          role="radio"
          aria-checked={value === i}
          onClick={() => onChange(i)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-200",
            value === i ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-line-strong",
          )}
        >
          <Building2 aria-hidden className="size-3.5" />
          {f.business.name}
        </button>
      ))}
    </div>
  );
}

function ReviewPanel() {
  const [i, setI] = React.useState(0);
  const { business: b, brief } = featured[i];
  return (
    <div>
      <PanelHeader>Opportunity Brief for a web design offer</PanelHeader>
      <LeadPicker value={i} onChange={setI} />
      <div key={b.id} className="card mt-3 animate-fade-up p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-base font-bold text-ink">{b.name}</h4>
          <FitBadge level={brief.fit.level} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink">Observed facts</p>
            <ul className="space-y-1.5 text-[13px] leading-5">
              {brief.facts.slice(0, 5).map((f) => (
                <li key={f.id} className="flex gap-2">
                  <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-green" />
                  {f.text}
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-4 flex items-center gap-2 text-xs font-semibold text-ink">
              Possible opportunity <AiSuggestionBadge />
            </p>
            <p className="rounded-lg border border-dashed border-info-fg/30 bg-info-bg/40 px-2.5 py-2 text-[13px] leading-5">
              {brief.opportunities[0]?.text ?? "Nothing stands out for this offer. That's useful to know too."}
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink">Sources · expand to inspect</p>
            <div className="space-y-1.5">
              {b.evidence.map((e, n) => (
                <EvidenceItem key={e.id} evidence={e} defaultOpen={n === 2} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WritePanel() {
  const [i, setI] = React.useState(0);
  const [tone, setTone] = React.useState<Tone>("friendly");
  const [variant, setVariant] = React.useState(0);
  const d = draftFor(i, tone, variant);
  const fact = featured[i].brief.facts.find((f) => d.factIds.includes(f.id));
  return (
    <div>
      <PanelHeader>Draft preview · nothing is sent</PanelHeader>
      <LeadPicker
        value={i}
        onChange={(n) => {
          setI(n);
          setVariant(0);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="tour-tone" className="text-[13px] text-slate">
          Tone
        </label>
        <div className="w-40">
          <Select id="tour-tone" value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="h-8 text-[13px]">
            <option value="friendly">Friendly</option>
            <option value="direct">Direct</option>
            <option value="consultative">Consultative</option>
          </Select>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setVariant((v) => v + 1)}>
          Another angle
        </Button>
      </div>
      <div key={`${i}-${tone}-${variant}`} className="card mt-3 animate-fade-up overflow-hidden">
        <div className="border-b border-line px-4 py-2.5 text-[13px]">
          <span className="text-slate">Subject </span>
          <span className="font-medium text-ink">{d.subject}</span>
        </div>
        <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-[13.5px] leading-6 text-ink">{d.body}</pre>
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/60 px-4 py-2.5 text-xs text-slate">
          <span className="font-medium text-ink">Grounded in:</span>
          {fact ? <Badge tone="green">{fact.text}</Badge> : <span>No specific fact. Consider skipping this lead.</span>}
        </div>
      </div>
    </div>
  );
}

const sampleReplies = [
  {
    from: featured[3].business.name,
    label: "interested" as const,
    snippet: "Funny timing. We've talked about online booking a few times this year…",
    body: "Funny timing. We've talked about online booking a few times this year. What would something like that involve for a practice our size? Happy to set up a call next week.",
    suggestion: "Thanks for getting back to me. Would Tuesday at 10am or Wednesday at 2pm work for a 15-minute call?",
  },
  {
    from: featured[4].business.name,
    label: "out_of_office" as const,
    snippet: "Our office is closed for staff training and will reopen Monday…",
    body: "Thank you for your email. Our office is closed for staff training and will reopen Monday. Messages will be reviewed then.",
    suggestion: null,
  },
  {
    from: featured[1].business.name,
    label: "not_interested" as const,
    snippet: "Thanks, but we're happy with our current site…",
    body: "Thanks, but we're happy with our current site. Please take us off your list.",
    suggestion: "Understood, thanks for letting me know. I've removed you from my list and won't follow up.",
  },
];

const labelText = { interested: "Interested", not_interested: "Not interested", out_of_office: "Out of office", unclassified: "Unclassified" };
const labelTone = { interested: "green", not_interested: "neutral", out_of_office: "warn", unclassified: "outline" } as const;

function RepliesPanel() {
  const [i, setI] = React.useState(0);
  const [labels, setLabels] = React.useState(sampleReplies.map((r) => r.label as keyof typeof labelText));
  const r = sampleReplies[i];
  return (
    <div>
      <PanelHeader>Inbox · replies from a sample campaign</PanelHeader>
      <div className="grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ul className="card divide-y divide-line overflow-hidden" aria-label="Sample replies">
          {sampleReplies.map((x, n) => (
            <li key={x.from}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-current={i === n}
                className={cn("block w-full px-3 py-2.5 text-left transition-colors duration-200", i === n ? "bg-mint-soft/50" : "hover:bg-canvas")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink">{x.from}</span>
                  <Badge tone={labelTone[labels[n]]}>{labelText[labels[n]]}</Badge>
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate">{x.snippet}</span>
              </button>
            </li>
          ))}
        </ul>
        <div key={i} className="card animate-fade-up p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Inbox aria-hidden className="size-4 text-green" /> {r.from}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="tour-class" className="text-xs text-slate">
                Label
              </label>
              <Select
                id="tour-class"
                className="h-8 w-40 text-[13px]"
                value={labels[i]}
                onChange={(e) => setLabels((ls) => ls.map((l, n) => (n === i ? (e.target.value as keyof typeof labelText) : l)))}
              >
                {Object.entries(labelText).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-[13.5px] leading-6 text-ink">{r.body}</p>
          {r.suggestion ? (
            <div className="mt-3 rounded-lg border border-dashed border-info-fg/30 px-3 py-2.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                Suggested reply <AiSuggestionBadge /> <span className="font-normal text-slate">Draft · you send it</span>
              </p>
              <p className="mt-1.5 text-[13.5px] leading-6 text-ink">{r.suggestion}</p>
            </div>
          ) : (
            <p className="mt-3 text-[13px] leading-6 text-slate">
              Out-of-office replies don&apos;t stop the sequence on their own. Without a reliable return date, the lead is flagged for you to review.
            </p>
          )}
          <p className="mt-3 text-xs text-slate">Follow-ups for this lead stopped when the reply arrived.</p>
        </div>
      </div>
    </div>
  );
}
