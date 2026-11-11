import { Callout } from "@/components/ui/misc";
import { getSupportInbox } from "@/server/services/support";
import { SupportInbox } from "@/features/admin/support-inbox";

/** Admin → Support: the request queue, the conversation, and the customer. */
export async function SupportTab({ params }: { params: { tab?: string; search?: string; topic?: string; priority?: string; channel?: string; ticket?: string } }) {
  const d = await getSupportInbox(params);
  return (
    <div className="space-y-4">
      {!d.ready ? <Callout tone="warn" title="Database update needed">Run database/migrations/0019_support.sql in Neon to turn on support.</Callout> : null}
      <SupportInbox data={d} />
    </div>
  );
}
