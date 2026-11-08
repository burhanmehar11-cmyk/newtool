import "server-only";
import { track } from "@/server/events";
import type { OfferProfile } from "@/lib/domain/types";
import { offerProfileSchema, onboardingSchema } from "@/lib/domain/schemas";
import { withUser } from "@/server/db";
import { getActiveWorkspace, requireUser, type WorkspaceRef, listWorkspaces } from "@/server/auth";

export type ServiceResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const COLUMNS = "service_type, service, target_customer, value_prop, tone, sender_name, sender_title, company_name, business_address, booking_link";

const toParams = (o: OfferProfile) => [
  o.serviceType,
  o.service,
  o.targetCustomer,
  o.valueProp,
  o.tone,
  o.senderName,
  o.senderTitle,
  o.companyName,
  o.businessAddress,
  o.bookingLink,
];

type OfferRow = {
  service_type: OfferProfile["serviceType"];
  service: string;
  target_customer: string;
  value_prop: string;
  tone: OfferProfile["tone"];
  sender_name: string;
  sender_title: string;
  company_name: string;
  business_address: string;
  booking_link: string;
};

const fromRow = (r: OfferRow): OfferProfile => ({
  serviceType: r.service_type,
  service: r.service,
  targetCustomer: r.target_customer,
  valueProp: r.value_prop,
  tone: r.tone,
  senderName: r.sender_name,
  senderTitle: r.sender_title,
  companyName: r.company_name,
  businessAddress: r.business_address,
  bookingLink: r.booking_link,
});

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

const UPSERT_OFFER = `insert into public.offer_profiles (workspace_id, ${COLUMNS}, updated_by)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  on conflict (workspace_id) do update set
    service_type = excluded.service_type, service = excluded.service, target_customer = excluded.target_customer,
    value_prop = excluded.value_prop, tone = excluded.tone, sender_name = excluded.sender_name,
    sender_title = excluded.sender_title, company_name = excluded.company_name,
    business_address = excluded.business_address, booking_link = excluded.booking_link, updated_by = excluded.updated_by`;

/** Creates a workspace owned by the caller, plus its offer profile, in one transaction. */
export async function createWorkspaceWithOffer(input: unknown): Promise<ServiceResult<{ workspaceId: string }>> {
  const user = await requireUser("/app/onboarding");
  if ((await listWorkspaces()).length) return { ok: false, error: "You already have a workspace. Invite teammates from Team instead of creating another." };
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const { workspaceName, ...offer } = parsed.data;
  try {
    const workspaceId = await withUser(user.id, async (q) => {
      const ws = await q.query<{ id: string }>("select public.create_workspace($1) as id", [workspaceName]);
      const id = ws.rows[0].id;
      await q.query(UPSERT_OFFER, [id, ...toParams(offer), user.id]);
      return id;
    });
    await track({
      workspaceId,
      userId: user.id,
      kind: "onboarded",
      area: "account",
      outcome: "success",
      summary: `Finished setup: workspace "${workspaceName}" with their offer`,
      notify: {
        title: "Welcome to Locenti",
        body: "Next: connect a Gmail mailbox, then search Google Maps for businesses to contact. The tour (top of the Dashboard) shows where everything is.",
        href: "/app/mailboxes",
        level: "success",
        to: { userId: user.id },
        dedupeKey: "welcome",
      },
    });
    return { ok: true, value: { workspaceId } };
  } catch {
    await track({ userId: user.id, kind: "onboarding_failed", area: "account", outcome: "failed", summary: "Creating their workspace failed" });
    return { ok: false, error: "Could not create the workspace. Nothing was saved. Try again." };
  }
}

export async function getOfferProfile(workspace: WorkspaceRef): Promise<OfferProfile | null> {
  const user = await requireUser();
  return getOfferProfileFor(user.id, workspace.id);
}

/** Same, for callers that already know the user (e.g. the MCP endpoint). RLS still applies. */
export async function getOfferProfileFor(userId: string, workspaceId: string): Promise<OfferProfile | null> {
  const r = await withUser(userId, (q) => q.query<OfferRow>(`select ${COLUMNS} from public.offer_profiles where workspace_id = $1`, [workspaceId]));
  return r.rows[0] ? fromRow(r.rows[0]) : null;
}

export async function saveOfferProfile(input: unknown): Promise<ServiceResult> {
  const user = await requireUser("/app/settings");
  const workspace = await getActiveWorkspace();
  if (!workspace) return { ok: false, error: "No workspace selected." };
  const parsed = offerProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    await withUser(user.id, (q) => q.query(UPSERT_OFFER, [workspace.id, ...toParams(parsed.data), user.id]));
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, error: "Could not save the offer profile. Try again." };
  }
}

export async function renameWorkspace(name: unknown): Promise<ServiceResult> {
  const user = await requireUser("/app/settings");
  const workspace = await getActiveWorkspace();
  if (!workspace) return { ok: false, error: "No workspace selected." };
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only the workspace owner can rename it." };
  const n = typeof name === "string" ? name.trim() : "";
  if (n.length < 2 || n.length > 80) return { ok: false, error: "Use 2 to 80 characters.", fieldErrors: { name: "Use 2 to 80 characters." } };
  const r = await withUser(user.id, (q) => q.query("update public.workspaces set name = $1 where id = $2", [n, workspace.id]));
  return r.rowCount ? { ok: true, value: undefined } : { ok: false, error: "Could not rename this workspace." };
}

export type UsageRow = { kind: "discovery" | "verification" | "ai"; allowance: number; used: number; reserved: number };

/** Allowance and committed usage per kind, read from the ledger (members have read-only access). */
export async function getUsage(workspace: WorkspaceRef): Promise<UsageRow[]> {
  const user = await requireUser();
  const [allowances, ledger] = await withUser(user.id, async (q) => [
    (await q.query<{ kind: string; units: number }>("select kind, units from public.workspace_allowances where workspace_id = $1", [workspace.id])).rows,
    (
      await q.query<{ kind: string; entry_type: string; units: number; reservation_key: string | null; idempotency_key: string }>(
        "select kind, entry_type, units, reservation_key, idempotency_key from public.usage_ledger where workspace_id = $1",
        [workspace.id],
      )
    ).rows,
  ] as const);
  return (["discovery", "verification", "ai"] as const).map((kind) => {
    const l = ledger.filter((x) => x.kind === kind);
    const sum = (t: string) => l.filter((x) => x.entry_type === t).reduce((a, x) => a + x.units, 0);
    const reserved = l
      .filter((x) => x.entry_type === "reserve")
      .reduce((a, r) => a + Math.max(0, r.units - l.filter((x) => x.reservation_key === r.idempotency_key).reduce((s, x) => s + x.units, 0)), 0);
    return { kind, allowance: allowances.find((a) => a.kind === kind)?.units ?? 0, used: sum("charge") - sum("refund"), reserved };
  });
}
