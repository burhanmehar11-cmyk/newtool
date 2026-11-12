import { NextResponse, type NextRequest } from "next/server";

/**
 * The old "Connect Gmail" (Google sign-in with the Gmail API) is retired:
 * Locenti no longer asks Google for Gmail permissions. Old links open the
 * App Password panel on the Mailboxes page instead.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/app/mailboxes?connect=1", request.url));
}
