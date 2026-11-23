import { NextResponse, type NextRequest } from "next/server";
import { registerClient } from "@/server/services/oauth";

/** RFC 7591 dynamic client registration for AI apps (public clients with PKCE). */

const recent = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (list.length >= 30) return false;
  list.push(now);
  recent.set(ip, list);
  return true;
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!allowed(ip)) return NextResponse.json({ error: "invalid_request", error_description: "Too many registrations. Try again later." }, { status: 429, headers: cors });
  const body = await request.json().catch(() => null);
  const r = await registerClient(body);
  if (!r.ok) return NextResponse.json({ error: r.error, error_description: r.description }, { status: 400, headers: cors });
  return NextResponse.json(r.client, { status: 201, headers: { ...cors, "cache-control": "no-store" } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}
