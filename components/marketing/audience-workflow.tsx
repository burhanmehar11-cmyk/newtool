import { Bot, Compass, Inbox, MapPinned, MessageSquareReply, MonitorSmartphone, PenLine, Search, Sheet, TrendingUp, Microscope, Globe } from "lucide-react";

const roles = [
  { icon: MapPinned, label: "Local SEO" },
  { icon: MonitorSmartphone, label: "Web design" },
  { icon: TrendingUp, label: "Digital marketing" },
  { icon: Bot, label: "AI automation" },
];

export function AudienceStrip() {
  return (
    <section aria-label="Who it's for" className="border-b border-line bg-surface">
      <div className="container-page flex flex-col gap-4 py-7 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-slate">Built for agencies and consultants who sell to local businesses</p>
        <ul className="flex flex-wrap gap-2">
          {roles.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm font-medium text-ink">
              <Icon aria-hidden className="size-4 text-green" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const friction = [
  { icon: Globe, tool: "Map listings", task: "Scroll results one city at a time" },
  { icon: Microscope, tool: "20 browser tabs", task: "Open each website to look for a reason to reach out" },
  { icon: Sheet, tool: "Spreadsheet", task: "Copy names, emails and notes by hand" },
  { icon: PenLine, tool: "Docs", task: "Rewrite the same email with a new first line" },
  { icon: Inbox, tool: "Inbox", task: "Find replies between everything else" },
];

const stages = [
  {
    icon: Search,
    name: "Discover",
    copy: "Describe your ideal customer in plain words. Review the parsed filters, then search by niche and location.",
    detail: "Dental clinics · Austin · has website · 30+ reviews",
  },
  {
    icon: Compass,
    name: "Understand",
    copy: "Each lead gets an Opportunity Brief: what was observed, where, when, and why it may matter for your offer.",
    detail: "Contact page · “Call to schedule” · collected Oct 27",
  },
  {
    icon: PenLine,
    name: "Personalize",
    copy: "Drafts start from the evidence. You edit, approve the exact version, and choose who receives it.",
    detail: "v3 approved · 12 recipients · 3 excluded",
  },
  {
    icon: MessageSquareReply,
    name: "Follow up",
    copy: "Short sequences stop on reply. Replies are classified for you to confirm, and you send every answer.",
    detail: "Interested · follow-ups stopped",
  },
];

export function Workflow() {
  return (
    <section id="how-it-works" className="bg-canvas py-20 sm:py-28">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <p className="eyebrow text-green">The problem</p>
            <h2 className="display-2 mt-4 text-ink">Good outreach takes research. Research takes all afternoon.</h2>
            <p className="mt-5 max-w-md text-[17px] leading-8 text-slate">
              Finding a business is easy. Knowing why it might need you, and saying so in a way that sounds human, is the slow part. It usually happens across five tools.
            </p>
          </div>
          <ol className="relative space-y-2.5" aria-label="A typical prospecting afternoon">
            {friction.map(({ icon: Icon, tool, task }, i) => (
              <li
                key={tool}
                className="card flex items-center gap-4 px-4 py-3.5"
                style={{ marginLeft: `${[0, 28, 8, 40, 16][i]}px`, marginRight: `${[32, 0, 24, 4, 20][i]}px` }}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-slate">
                  <Icon aria-hidden className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{tool}</span>
                  <span className="block text-sm text-slate">{task}</span>
                </span>
                <span className="ml-auto hidden text-xs tabular-nums text-slate sm:block">Step {i + 1}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-24">
          <div className="max-w-2xl">
            <p className="eyebrow text-green">How it works</p>
            <h2 className="display-2 mt-4 text-ink">One workspace, four stages.</h2>
          </div>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
            {stages.map(({ icon: Icon, name, copy, detail }, i) => (
              <li key={name} className="relative flex flex-col bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-midnight text-mint">
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-slate">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-ink">{name}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-7 text-slate">{copy}</p>
                <p className="mt-5 rounded-lg bg-canvas px-3 py-2 font-mono text-[11.5px] leading-5 text-ink">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
