import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Q } from "@/server/auth-store";
import { adminApiActor } from "@/server/admin-api-auth";
import { PLANS, setPlan } from "@/server/admin-store";
import { withService } from "@/server/db";
import { dailyLimit } from "@/server/providers/google-places";
import { monthlyDiscoveryForAdmin } from "@/server/services/discovery";

/**
 * Private admin API (ADMIN_API_TOKEN) for search limits.
 *
 *   GET ?email=you@x.com                         → that person's workspaces: plan, role, this month's searches used / limit,
 *                                                  and today's Google Maps calls against GOOGLE_PLACES_DAILY_LIMIT
 *   POST {action:"set_plan", workspaceId, plan, note?} → e.g. "comp" (complimentary: no monthly limit); logged in the admin audit
 */

const svc = <T,>(fn: (q: Q) => Promise<T>) => withService((q) => fn(q as unknown as Q));
const denied = () => NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });

export async function GET(request: NextRequest) {
  if (!adminApiActor(request)) return denied();
  const email = z.string().trim().toLowerCase().email().safeParse(request.nextUrl.searchParams.get("email"));
  if (!email.success) return NextResponse.json({ ok: false, error: "Give ?email=" }, { status: 400 });
  const rows = await svc((q) =>
    q.query<{ id: string; name: string; role: string; plan: string | null; owner: string | null }>(
      `select w.id, w.name, m.role, to_jsonb(w)->>'plan' as plan,
         (select u2.email from public.memberships m2 join auth.users u2 on u2.id = m2.user_id where m2.workspace_id = w.id and m2.role = 'owner' limit 1) as owner
       from auth.users u join public.memberships m on m.user_id = u.id join public.workspaces w on w.id = m.workspace_id
       where lower(u.email) = $1 order by w.created_at`,
      [email.data],
    ),
  );
  const workspaces = await Promise.all(rows.rows.map(async (w) => ({ ...w, month: await monthlyDiscoveryForAdmin(w.id) })));
  const calls = (await svc((q) => q.query<{ calls: number }>("select calls from app.provider_daily_calls where provider = 'google_places' and day = (now() at time zone 'utc')::date"))).rows[0]?.calls ?? 0;
  return NextResponse.json({ ok: true, email: email.data, workspaces, googleToday: { calls, limit: dailyLimit() } }, { headers: { "cache-control": "no-store" } });
}

const body = z.object({ action: z.literal("set_plan"), workspaceId: z.string().uuid(), plan: z.enum(PLANS as [string, ...string[]]), note: z.string().trim().max(300).optional() });

export async function POST(request: NextRequest) {
  const actor = adminApiActor(request);
  if (!actor) return denied();
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: `Invalid request: ${p.error.issues[0]?.message ?? "check the body"}` }, { status: 400 });
  const ok = await svc((q) => setPlan(q, actor.email, p.data.workspaceId, { plan: p.data.plan as (typeof PLANS)[number], trialEndsAt: null, note: p.data.note ?? null }));
  return ok ? NextResponse.json({ ok: true, workspaceId: p.data.workspaceId, plan: p.data.plan }) : NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 404 });
}
