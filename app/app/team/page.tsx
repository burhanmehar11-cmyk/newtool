import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRound, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { SectionCard } from "@/components/app/page-header";
import { PageHero } from "@/components/app/page-hero";
import { PageLoading } from "@/features/product/page-loading";
import { InviteForm, InviteList, MemberList } from "@/features/team/team-manager";
import { getTeam } from "@/server/services/team";

export const metadata: Metadata = { title: "Team" };

const roles = [
  { icon: ShieldCheck, title: "Owner", text: "Created the workspace. Everything an admin can do; can't be removed." },
  { icon: KeyRound, title: "Admin", text: "Invites and removes people, connects mailboxes, creates and approves campaigns." },
  { icon: UserRound, title: "Member", text: "Searches, saves and researches leads, writes drafts and works the Inbox." },
];

export default function TeamPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Team />
    </Suspense>
  );
}

async function Team() {
  const { me, workspace, canManage, members, invites, emailOn } = await getTeam();
  return (
    <div>
      <PageHero
        icon={UsersRound}
        eyebrow="Workspace"
        title="Team"
        description={`Invite teammates to ${workspace.name}. Everyone shares the same leads, campaigns, mailboxes and Inbox; roles decide who can send.`}
        stats={[
          { label: "Members", value: String(members.length) },
          { label: "Admins", value: String(members.filter((m) => m.role === "owner" || m.role === "admin").length), hint: "including the owner" },
          { label: "Open invites", value: canManage ? String(invites.length) : "—", hint: canManage ? "valid for 7 days" : "visible to admins" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-5">
          {canManage ? (
            <SectionCard title="Invite someone" description="They sign in with the invited email address and join this workspace.">
              <InviteForm emailOn={emailOn} />
            </SectionCard>
          ) : null}
          <SectionCard title="Members" bodyClassName="p-0">
            <MemberList members={members} me={me} canManage={canManage} />
          </SectionCard>
          {canManage ? (
            <SectionCard title="Open invites" bodyClassName="p-0">
              <InviteList invites={invites} />
            </SectionCard>
          ) : null}
        </div>
        <SectionCard title="Roles" description="What each role can do in this workspace.">
          <ul className="space-y-4">
            {roles.map((r) => {
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
