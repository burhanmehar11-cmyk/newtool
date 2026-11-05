import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, SectionCard } from "@/components/app/page-header";
import { PageLoading } from "@/features/product/page-loading";
import { MailboxesCard } from "@/features/settings/mailboxes-card";
import { requireWorkspace } from "@/server/auth";
import { getMailboxes } from "@/server/services/mailboxes";

export const metadata: Metadata = { title: "Mailboxes" };

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
  };
  return (
    <div>
      <PageHeader title="Mailboxes" description="Gmail accounts your campaigns send from. Send-only access: Locentio can't read your inbox." />
      <div className="max-w-2xl">
        <SectionCard title="Sending mailboxes">
          <MailboxesCard mailboxes={mailboxes} canEdit={["owner", "admin"].includes(workspace.role)} notice={notice} />
        </SectionCard>
      </div>
    </div>
  );
}
