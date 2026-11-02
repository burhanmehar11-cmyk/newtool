import { CalendarClock, FolderKanban, Gauge, MessageSquareReply, SlidersHorizontal, MailCheck, ShieldBan, Tags, Users } from "lucide-react";
import { availabilityLabel, features, type FeatureKey } from "@/config/milestone";
import { EmailStatusBadge } from "@/components/product/badges";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Status({ k }: { k: FeatureKey }) {
  const f = features[k];
  return (
    <Badge tone={f.availability === "planned" ? "outline" : f.availability === "demo" ? "demo" : "green"}>
      {availabilityLabel(f.availability, f.target)}
    </Badge>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card flex flex-col p-6", className)}>{children}</div>;
}

function Head({ icon: Icon, title, k }: { icon: React.ComponentType<{ className?: string }>; title: string; k: FeatureKey }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-mint-soft text-green">
          <Icon className="size-[18px]" />
        </span>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
      </div>
      <Status k={k} />
    </div>
  );
}

export function Capabilities() {
  return (
    <section className="bg-canvas py-20 sm:py-28">
      <div className="container-page">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow text-green">Capabilities</p>
            <h2 className="display-2 mt-4 text-ink">The controls outreach actually needs.</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate">
            Today these run in the interactive demo with sample data. Live versions arrive with the private beta. Planned items are marked.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <Head icon={SlidersHorizontal} title="Targeting filters" k="discovery" />
            <p className="mt-3 max-w-md text-[15px] leading-7 text-slate">
              Niche, city, radius, rating, review count and website presence. Parsed from plain English, always editable, with the maximum usage shown before you run anything.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["Niche", "Physical therapy"],
                ["City", "Denver, CO"],
                ["Radius", "Within 10 mi"],
                ["Rating", "4.0 or higher"],
                ["Reviews", "25 or more"],
                ["Website", "Any"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[10px] border border-line bg-canvas/60 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate">{k}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{v}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-5">
            <Head icon={MailCheck} title="Contact verification states" k="verification" />
            <p className="mt-3 text-[15px] leading-7 text-slate">Five honest states. Only valid addresses are sent to by default. Verification reduces uncertainty. It does not guarantee delivery.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {(
                [
                  ["valid", "Sent to"],
                  ["catch_all", "Excluded by default"],
                  ["unknown", "Excluded by default"],
                  ["invalid", "Never sent to"],
                  ["unverified", "Verify first"],
                ] as const
              ).map(([s, rule]) => (
                <li key={s} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0">
                  <EmailStatusBadge status={s} />
                  <span className="text-slate">{rule}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-4">
            <Head icon={CalendarClock} title="Sequence controls" k="sequences" />
            <p className="mt-3 text-[15px] leading-7 text-slate">Short sequences, business hours, daily caps per mailbox. Pause and resume at any time.</p>
            <ol className="mt-5 space-y-2 text-sm">
              {[
                ["Day 0", "Personal first email"],
                ["Day 3", "Short follow-up"],
                ["Day 8", "Last note"],
              ].map(([d, t]) => (
                <li key={d} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-green">{d}</span>
                  <span className="flex-1 rounded-lg border border-line px-2.5 py-1.5 text-ink">{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate">Stops automatically on reply, unsubscribe or bounce.</p>
          </Card>

          <Card className="lg:col-span-4">
            <Head icon={MessageSquareReply} title="Reply handling" k="replySync" />
            <p className="mt-3 text-[15px] leading-7 text-slate">One inbox for every campaign, with editable labels and suggested answers that stay drafts until you send them.</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              <Badge tone="green">Interested</Badge>
              <Badge tone="neutral">Not interested</Badge>
              <Badge tone="warn">Out of office</Badge>
              <Badge tone="outline">Unanswered</Badge>
            </div>
            <p className="mt-auto flex items-center gap-2 pt-5 text-xs text-slate">
              <ShieldBan aria-hidden className="size-3.5" /> Unsubscribes join a workspace-wide suppression list.
            </p>
          </Card>

          <Card className="lg:col-span-4">
            <Head icon={Gauge} title="Transparent usage" k="usage" />
            <p className="mt-3 text-[15px] leading-7 text-slate">See the estimate before work starts and the actual charge after. Failed pages are not charged, and retries never charge twice.</p>
            <div className="mt-5 rounded-[10px] border border-line bg-canvas/60 p-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate">Search estimate</span>
                <span className="font-medium tabular-nums">up to 25 units</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-slate">Actually returned</span>
                <span className="font-medium tabular-nums">18 units</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-slate">Released</span>
                <span className="font-medium tabular-nums text-green">7 units</span>
              </div>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-demo-fg">Sample data</p>
            </div>
          </Card>

          <Card className="bg-midnight-2 border-line-dark lg:col-span-12 lg:flex-row lg:items-center lg:gap-10">
            <div className="lg:w-[46%]">
              <div className="on-dark flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-mint/15 text-mint">
                    <FolderKanban className="size-[18px]" />
                  </span>
                  <h3 className="text-lg font-bold text-white">Workspace organization</h3>
                </div>
              </div>
              <p className="mt-3 text-[15px] leading-7 text-fog">
                Saved lists, tags, notes, CSV import and export, with deduplication by business and address. Separate client workspaces and team roles are planned for agencies.
              </p>
            </div>
            <div className="mt-6 grid flex-1 gap-3 sm:grid-cols-3 lg:mt-0">
              {[
                { icon: Tags, label: "Lists and tags", k: "csv" as const },
                { icon: Users, label: "Team roles", k: "roles" as const },
                { icon: FolderKanban, label: "Client workspaces", k: "multiWorkspace" as const },
              ].map(({ icon: Icon, label, k }) => (
                <div key={label} className="rounded-[12px] border border-line-dark bg-midnight/50 p-4">
                  <Icon aria-hidden className="size-4 text-mint" />
                  <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-xs text-fog">{availabilityLabel(features[k].availability, features[k].target)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
