import { CircleCheck, Mail, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { adminTimeZone } from "@/lib/admin";
import { getAnnouncementsData } from "@/server/services/announcements";
import { AnnouncementComposer } from "@/features/admin/announcement-composer";
import { WelcomePreview } from "@/features/admin/welcome-preview";

/** Admin → Announcements: write or pick a product email, test it, send it to every registered user. */
export async function AnnouncementsTab() {
  const d = await getAnnouncementsData();
  const channel = d.channel.kind === "smtp" ? "your SMTP service" : d.channel.kind === "gmail" ? d.channel.email : null;
  return (
    <div className="space-y-5">
      {!d.ready ? <Callout tone="warn" title="Database update needed">Run database/migrations/0017_announcements.sql in Neon to send announcements.</Callout> : null}
      {!channel ? (
        <Callout tone="danger" title="Email sending isn't set up">Connect your Gmail on the Mailboxes page (in a workspace you own), or set SMTP_URL, then come back.</Callout>
      ) : (
        <div className="card flex flex-wrap items-start gap-3 p-4 text-sm">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-green" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-ink">
              Sends through <span className="font-medium">{channel}</span>
              {d.from ? (
                <>
                  , as <span className="font-medium">{d.from}</span>
                  {d.channel.kind === "gmail" ? " (only if Gmail has it as a “Send mail as” address; otherwise Gmail shows your own address)" : ""}
                </>
              ) : null}
              . Replies go to <span className="font-medium">{d.replyTo}</span>.
            </p>
            <p className="text-xs text-slate">
              Every email has an unsubscribe link and one-click unsubscribe. A personal Gmail sends about 500 emails a day; a send pauses at the limit and can be resumed the next day without repeats.
            </p>
          </div>
        </div>
      )}
      <WelcomePreview />
      <AnnouncementComposer
        templates={d.templates}
        recipients={d.recipients}
        optOuts={d.optOuts}
        canSend={d.ready && !!channel}
        site={d.site}
        trialDays={d.trialDays}
        paused={d.history.filter((a) => a.status === "sending").map((a) => ({ id: a.id, subject: a.subject }))}
      />
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-display text-base font-semibold text-ink">Sent announcements</h2>
        </div>
        {d.history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-canvas/60 text-xs text-slate">
                <tr>
                  <th className="px-5 py-2 font-medium">Started</th>
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 pr-3 font-medium">Sent</th>
                  <th className="py-2 pr-3 font-medium">Failed</th>
                  <th className="py-2 pr-5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.history.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate">{formatDateTime(a.created_at, adminTimeZone(), true)}</td>
                    <td className="py-2.5 pr-3 text-ink">{a.subject}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{a.sent}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{a.failed ? <span className="text-danger-fg">{a.failed}</span> : 0}</td>
                    <td className="py-2.5 pr-5 text-right">
                      {a.status === "sent" ? (
                        <Badge tone="green">
                          <CircleCheck aria-hidden className="size-3" /> Sent
                        </Badge>
                      ) : a.status === "stopped" ? (
                        <Badge tone="neutral">Stopped</Badge>
                      ) : (
                        <Badge tone="warn">
                          <TriangleAlert aria-hidden className="size-3" /> Paused, can resume
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-5 text-sm text-slate">Nothing sent yet.</p>
        )}
      </section>
    </div>
  );
}
