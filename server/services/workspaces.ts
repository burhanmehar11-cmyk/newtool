import "server-only";
import type { OfferProfile } from "@/lib/domain/types";
import { offerProfileSchema, onboardingSchema } from "@/lib/domain/schemas";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getActiveWorkspace, requireUser, type WorkspaceRef } from "@/server/auth";

export type ServiceResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const toRow = (o: OfferProfile) => ({
  service_type: o.serviceType,
  service: o.service,
  target_customer: o.targetCustomer,
  value_prop: o.valueProp,
  tone: o.tone,
  sender_name: o.senderName,
  sender_title: o.senderTitle,
  company_name: o.companyName,
  business_address: o.businessAddress,
  booking_link: o.bookingLink,
});

type OfferRow = ReturnType<typeof toRow>;

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

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/** Creates a workspace owned by the caller, plus its offer profile. */
export async function createWorkspaceWithOffer(input: unknown): Promise<ServiceResult<{ workspaceId: string }>> {
  const user = await requireUser("/app/onboarding");
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const { workspaceName, ...offer } = parsed.data;
  const supabase = await client();

  const { data: workspaceId, error } = await supabase.rpc("create_workspace", { ws_name: workspaceName });
  if (error || !workspaceId) return { ok: false, error: `Could not create the workspace: ${error?.message ?? "unknown error"}` };

  const { error: offerError } = await supabase
    .from("offer_profiles")
    .insert({ workspace_id: workspaceId, ...toRow(offer), updated_by: user.id });
  if (offerError) return { ok: false, error: `Workspace created, but the offer profile was not saved: ${offerError.message}` };

  return { ok: true, value: { workspaceId: workspaceId as string } };
}

export async function getOfferProfile(workspace: WorkspaceRef): Promise<OfferProfile | null> {
  const supabase = await client();
  const { data, error } = await supabase.from("offer_profiles").select("*").eq("workspace_id", workspace.id).maybeSingle();
  if (error) throw new Error(`Could not load the offer profile: ${error.message}`);
  return data ? fromRow(data as OfferRow) : null;
}

export async function saveOfferProfile(input: unknown): Promise<ServiceResult> {
  const user = await requireUser("/app/settings");
  const workspace = await getActiveWorkspace();
  if (!workspace) return { ok: false, error: "No workspace selected." };
  const parsed = offerProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const supabase = await client();
  const { error } = await supabase
    .from("offer_profiles")
    .upsert({ workspace_id: workspace.id, ...toRow(parsed.data), updated_by: user.id }, { onConflict: "workspace_id" });
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  return { ok: true, value: undefined };
}

export async function renameWorkspace(name: unknown): Promise<ServiceResult> {
  await requireUser("/app/settings");
  const workspace = await getActiveWorkspace();
  if (!workspace) return { ok: false, error: "No workspace selected." };
  if (!["owner", "admin"].includes(workspace.role)) return { ok: false, error: "Only the workspace owner can rename it." };
  const n = typeof name === "string" ? name.trim() : "";
  if (n.length < 2 || n.length > 80) return { ok: false, error: "Use 2 to 80 characters.", fieldErrors: { name: "Use 2 to 80 characters." } };
  const supabase = await client();
  const { error } = await supabase.from("workspaces").update({ name: n }).eq("id", workspace.id);
  if (error) return { ok: false, error: `Could not rename: ${error.message}` };
  return { ok: true, value: undefined };
}

export type UsageRow = { kind: "discovery" | "verification" | "ai"; allowance: number; used: number; reserved: number };

/** Allowance and committed usage per kind, computed from the ledger the member can read. */
export async function getUsage(workspace: WorkspaceRef): Promise<UsageRow[]> {
  const supabase = await client();
  const [{ data: allowances, error: e1 }, { data: ledger, error: e2 }] = await Promise.all([
    supabase.from("workspace_allowances").select("kind, units").eq("workspace_id", workspace.id),
    supabase.from("usage_ledger").select("kind, entry_type, units, reservation_key, idempotency_key").eq("workspace_id", workspace.id),
  ]);
  if (e1 || e2) throw new Error(`Could not load usage: ${(e1 ?? e2)!.message}`);
  return (["discovery", "verification", "ai"] as const).map((kind) => {
    const l = (ledger ?? []).filter((x) => x.kind === kind);
    const sum = (t: string) => l.filter((x) => x.entry_type === t).reduce((a, x) => a + x.units, 0);
    const reserved = l
      .filter((x) => x.entry_type === "reserve")
      .reduce((a, r) => {
        const settled = l.filter((x) => x.reservation_key === r.idempotency_key).reduce((s, x) => s + x.units, 0);
        return a + Math.max(0, r.units - settled);
      }, 0);
    return { kind, allowance: allowances?.find((a) => a.kind === kind)?.units ?? 0, used: sum("charge") - sum("refund"), reserved };
  });
}
