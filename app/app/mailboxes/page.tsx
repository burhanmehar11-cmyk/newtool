import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, Mail, MailCheck, ShieldCheck, Timer, UserX } from "lucide-react";
import { SectionCard } from "@/components/app/page-header";
import { PageHero } from "@/components/app/page-hero";
import { PageLoading } from "@/features/product/page-loading";
import { MailboxesCard } from "@/features/settings/mailboxes-card";
import { hasReadScope } from "@/lib/gmail/oauth";
import { requireWorkspace } from "@/server/auth";
import { getMailboxes } from "@/server/services/mailboxes";

export const metadata: Metadata = { title: "Mailboxes" };

const rules = [
  { icon: MailCheck, title: "Only what you approve", text: "Nothing is sent until you approve a campaign. Each email goes out from your own mailbox, so replies land in your inbox." },
  { icon: Timer, title: "Paced like a person", text: "One email per mailbox at a time, at least 3 minutes apart, up to the daily cap you set." },
  { icon: Clock, title: "Inside your sending window", text: "Each campaign sends only on the days and hours you choose, in its time zone." },
  { icon: UserX, title: "Opt-outs are honoured", text: "Every email has a one-click unsubscribe. Unsubscribes and bounces join your do-not-contact list." },
  { icon: ShieldCheck, title: "Your password stays safe", text: "Use an App Password, not your real one. It's stored encrypted, used only to send approved campaigns and spot replies to them. Disconnect any time." },
];

export default function MailboxesPage({ searchParams }: PageProps<"/app/mailboxes">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Mailboxes searchParams={searchParams} />
    </Suspense>
  );
}

async function Mailboxes({ searchParams }: { searchParams: PageProps<"/app/mailboxes">["searchParams"] }) {
  const { workspace } = await requireWorkspace("/app/mailboxes");
  const sp = await searchParams;
  const mailboxes = await getMailboxes();
  const notice = {
    connected: sp.mailbox === "connected" && typeof sp.email === "string" ? sp.email.slice(0, 254) : undefined,
    error: typeof sp.mailbox_error === "string" ? sp.mailbox_error.slice(0, 40) : undefined,
    repliesOff: sp.replies === "off",
    openConnect: sp.connect === "1",
  };
  const connected = mailboxes.filter((m) => m.status === "connected");
  const tracking = connected.filter((m) => hasReadScope(m.scopes)).length;
  const capacity = connected.reduce((a, m) => a + m.daily_cap, 0);
  return (
    <div>
      <PageHero
        icon={Mail}
        eyebrow="Sending"
        title="Mailboxes"
        description="The email addresses your campaigns send from: Gmail, Google Workspace, Zoho, Hostinger or any IMAP/SMTP mailbox, connected with an App Password."
        stats={[
          { label: "Connected", value: String(connected.length), hint: mailboxes.length > connected.length ? `${mailboxes.length - connected.length} need attention` : undefined },
          { label: "Reply tracking", value: connected.length ? `${tracking} of ${connected.length}` : "—", hint: "mailboxes with replies sorted in Inbox" },
          { label: "Daily sending limit", value: capacity.toLocaleString("en-US"), hint: "emails per day across mailboxes" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SectionCard title="Sending mailboxes">
          <MailboxesCard mailboxes={mailboxes} canEdit={["owner", "admin"].includes(workspace.role)} notice={notice} />
        </SectionCard>
        <SectionCard title="How sending works" description="The same rules apply to every mailbox and campaign.">
          <ul className="space-y-4">
            {rules.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-green">
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{r.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-slate">{r.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
