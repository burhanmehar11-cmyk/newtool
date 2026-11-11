import { NextResponse, type NextRequest } from "next/server";
import { adminApiActor } from "@/server/admin-api-auth";
import { diagnoseHelpAssistant } from "@/server/services/help-assistant";

/**
 * Private admin API (ADMIN_API_TOKEN): asks the help assistant one test
 * question and reports whether it worked, or Google's exact error. Never
 * returns the key.
 */
export async function GET(request: NextRequest) {
  if (!adminApiActor(request)) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  return NextResponse.json(await diagnoseHelpAssistant(), { headers: { "cache-control": "no-store" } });
}
