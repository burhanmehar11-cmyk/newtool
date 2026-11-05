import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheck, CircleDashed, Settings as SettingsIcon } from "lucide-react";
import { SectionCard } from "@/components/app/page-header";
import { PageHero } from "@/components/app/page-hero";
import { PageLoading } from "@/features/product/page-loading";
import { ProductOfferForm, RenameWorkspaceForm } from "@/features/product/product-forms";
import { emptyOfferProfile } from "@/lib/domain/defaults";
import { requireWorkspace } from "@/server/auth";
import { getOfferProfile } from "@/server/services/workspaces";
import { getProviderStatus } from "@/server/providers/status";
import Link from "next/link";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { getMailboxes } from "@/server/services/mailboxes";

export const metadata: Metadata = { title: "Settings" };

export default function ProductSettingsPage({ searchParams }: PageProps<"/app/settings">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/app/settings">["searchParams"] }) {
  const { user, workspace } = await requireWorkspace("/app/settings");
  await searchParams;
  const [offer, mailboxes] = await Promise.all([getOfferProfile(workspace), getMailboxes()]);
  const providers = getProviderStatus();
  const connected = mailboxes.filter((m) => m.status === "connected").length;
  return (
    <div>
      <PageHero
        icon={SettingsIcon}
        eyebrow="Workspace"
        title="Settings"
        description="Your workspace, the offer Locenti writes about, appearance and connection status."
        stats={[
          { label: "Workspace", value: workspace.name, hint: `Your role: ${workspace.role}` },
          { label: "Offer profile", value: offer?.serviceType ? "Set" : "Not set", hint: offer?.serviceType ? "used for research and drafts" : "add it to write better emails" },
          { label: "Mailboxes connected", value: String(connected) },
          { label: "Connections", value: `${providers.filter((p) => p.configured).length} of ${providers.length}`, hint: "configured on this deployment" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-5">
          <SectionCard title="Workspace">
            <RenameWorkspaceForm name={workspace.name} canEdit={["owner", "admin"].includes(workspace.role)} />
          </SectionCard>
          <SectionCard title="Account">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate">Signed in as</dt>
                <dd className="text-ink">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Role in this workspace</dt>
                <dd className="capitalize text-ink">{workspace.role}</dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard title="Appearance" description="Saved in this browser. System follows your device setting.">
            <ThemeToggle withLabels />
          </SectionCard>
          <SectionCard title="Sending mailboxes" description="Gmail accounts campaigns send from.">
            <p className="text-sm text-slate">
              {connected} connected. <Link href="/app/mailboxes">Manage mailboxes</Link>
            </p>
          </SectionCard>
          <SectionCard title="Connections" description="Provider configuration for this deployment. Values are never shown." bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {providers.map((p) => (
                <li key={p.key} className="flex items-start gap-3 px-5 py-3">
                  {p.configured ? <CircleCheck aria-hidden className="mt-0.5 size-4 text-green" /> : <CircleDashed aria-hidden className="mt-0.5 size-4 text-slate" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{p.label}</p>
                    <p className="text-xs text-slate">
                      {p.configured ? "Configured" : "Not configured"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
        <div className="space-y-5">
        <SectionCard title="Offer profile" description="Used to score research and write drafts.">
            <ProductOfferForm defaultValues={offer ?? emptyOfferProfile} savedType={offer?.serviceType ?? null} />
          </SectionCard>
          <SectionCard title="AI" description="Built-in AI writer and your own agents.">
            <p className="text-sm text-slate">
              <Link href="/app/agent">Open Agent</Link> to write emails with AI or connect your own agent over MCP.
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
