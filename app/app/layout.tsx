import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductShell } from "@/components/app/product-shell";
import { WorkspaceSwitcher } from "@/features/product/workspace-switcher";
import { getActiveWorkspace, listWorkspaces } from "@/server/auth";
import { Skeleton } from "@/components/ui/misc";
import { SchemaBanner } from "@/features/product/schema-banner";

export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s · Locenti" },
  robots: { index: false, follow: false },
};

async function WorkspaceSlot() {
  const [workspaces, active] = await Promise.all([listWorkspaces().catch(() => []), getActiveWorkspace().catch(() => null)]);
  return <WorkspaceSwitcher workspaces={workspaces} activeId={active?.id ?? null} />;
}

export default function ProductLayout({ children }: LayoutProps<"/app">) {
  return (
    <ProductShell
      workspaceSlot={
        <Suspense fallback={<Skeleton className="h-[58px] w-full rounded-[10px]" />}>
          <WorkspaceSlot />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <SchemaBanner />
      </Suspense>
      {children}
    </ProductShell>
  );
}
