import type * as React from "react";
import { Bot, Compass, Globe, Inbox, Mail, MapPinned, MessageSquareReply, Microscope, MonitorSmartphone, PenLine, Send, Sheet, TrendingUp } from "lucide-react";
import { features, type Availability, type FeatureKey } from "@/config/milestone";

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
        <ul className="flex flex-wrap gap-2" data-stagger="70">
          {roles.map(({ icon: Icon, label }) => (
            <li key={label} data-reveal className="inline-flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm font-medium text-ink">
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

export function Workflow() {
  return (
    <section id="how-it-works" className="overflow-x-clip bg-canvas py-20 sm:py-28">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div data-reveal>
            <p className="eyebrow text-green">The problem</p>
            <h2 className="display-2 mt-4 text-ink">Good outreach takes research. Research takes all afternoon.</h2>
            <p className="mt-5 max-w-md text-[17px] leading-8 text-slate">
              Finding a business is easy. Knowing why it might need you, and saying so in a way that sounds human, is the slow part. It usually happens across five tools.
            </p>
          </div>
          <ol className="relative space-y-2.5" aria-label="A typical prospecting afternoon" data-stagger="90">
            {friction.map(({ icon: Icon, tool, task }, i) => (
              <li
                key={tool}
                data-reveal={i % 2 ? "right" : "left"}
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
          <div className="max-w-2xl" data-reveal>
            <p className="eyebrow text-green">How it works</p>
            <h2 className="display-2 mt-4 text-ink">From a map search to a real conversation.</h2>
            <p className="mt-5 text-[17px] leading-8 text-slate">Five steps, each one reviewed by you. Statuses show what&apos;s live in the private beta today.</p>
          </div>
          <HowItWorks />
        </div>
      </div>
    </section>
  );
}

const steps: { icon: React.ComponentType<{ className?: string }>; title: string; copy: string; status: FeatureKey[] }[] = [
  {
    icon: Mail,
    title: "Connect your mailbox",
    copy: "Link the Gmail account you already send from. You set the daily limit and sending hours; messages go out from your own address.",
    status: ["gmail"],
  },
  {
    icon: MapPinned,
    title: "Search Google Maps",
    copy: "Describe who you want to reach, like “dentists in Austin”. Locentio pulls matching local businesses from map listings, then reads their public websites for contact details.",
    status: ["discovery", "googleMaps"],
  },
  {
    icon: Compass,
    title: "Research and personalise",
    copy: "Each lead gets an Opportunity Brief: what its website shows, with sources, and why that matters for your offer. Drafts start from those facts.",
    status: ["opportunityBrief", "drafts"],
  },
  {
    icon: Send,
    title: "Approve and launch",
    copy: "Review the exact recipients and messages, then approve. Emails go out in small, paced batches within your limits.",
    status: ["sequences"],
  },
  {
    icon: MessageSquareReply,
    title: "Handle replies",
    copy: "Replies land in one inbox, sorted as interested, not interested or out of office. Follow-ups stop the moment someone answers.",
    status: ["replySync"],
  },
];

const isLive = (a: Availability) => a === "beta" || a === "live";

function StepStatus({ k }: { k: FeatureKey }) {
  const f = features[k];
  const live = isLive(f.availability);
  return (
    <span className={live ? "rounded-md bg-mint-soft px-1.5 py-0.5 text-[11px] font-medium text-green" : "rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-slate"}>
      {live ? `${f.label}: in private beta` : `${f.label}: coming soon`}
    </span>
  );
}

function HowItWorks() {
  return (
    <div className="relative mt-14">
      {/* Connecting line behind the numbers (desktop), drawn as you scroll. */}
      <div aria-hidden className="absolute left-[10%] right-[10%] top-8 hidden h-[3px] overflow-hidden rounded-full bg-line lg:block">
        <div data-draw className="h-full w-full rounded-full bg-gradient-to-r from-green via-green to-mint" />
      </div>
      <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-5" data-stagger="110">
        {steps.map(({ icon: Icon, title, copy, status }, i) => (
          <li key={title} data-reveal className="flex flex-col items-center text-center">
            <span className="relative z-10 flex size-16 items-center justify-center rounded-full border-4 border-canvas bg-midnight font-mono text-lg font-bold text-mint shadow-[0_0_0_1px_rgb(18_99_74/0.25),0_12px_30px_-12px_rgb(11_18_24/0.6)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="card mt-5 flex w-full flex-1 flex-col items-center p-5 transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-float">
              <span className="flex size-11 items-center justify-center rounded-xl bg-mint-soft text-green">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold leading-snug text-ink">{title}</h3>
              <p className="mt-2 flex-1 text-[14px] leading-6 text-slate">{copy}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {status.map((k) => (
                  <StepStatus key={k} k={k} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
