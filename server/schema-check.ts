import "server-only";
import type { Q } from "@/server/auth-store";
import { withService } from "@/server/db";

/**
 * Detects database updates (migrations) that haven't been run yet, by
 * checking for one column or table each migration adds. Shown to the
 * workspace as a banner naming the exact file to run, instead of pages
 * failing with a generic error. Cached for a few minutes per server.
 */
const MARKERS: { file: string; sql: string }[] = [
  { file: "0002_password_and_discovery.sql", sql: "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'discovery_results'" },
  { file: "0003_research.sql", sql: "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'businesses' and column_name = 'research_status'" },
  { file: "0004_google_places.sql", sql: "select 1 from information_schema.tables where table_schema = 'app' and table_name = 'provider_daily_calls'" },
  { file: "0005_mailboxes.sql", sql: "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sending_accounts' and column_name = 'scopes'" },
  { file: "0006_campaigns.sql", sql: "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'draft_id'" },
  { file: "0007_agents.sql", sql: "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'api_tokens'" },
  { file: "0008_replies.sql", sql: "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'threads' and column_name = 'last_inbound_at'" },
  { file: "0009_team.sql", sql: "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workspace_invites'" },
  { file: "0010_followups.sql", sql: "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dispatches' and column_name = 'rfc_message_id'" },
  { file: "0011_admin.sql", sql: "select 1 from information_schema.tables where table_schema = 'app' and table_name = 'site_visits'" },
  { file: "0012_webhooks.sql", sql: "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'webhook_endpoints'" },
  { file: "0013_viewer.sql", sql: "select 1 from pg_policies where schemaname = 'public' and policyname = 'leads_member_read'" },
  { file: "0014_billing.sql", sql: "select 1 from information_schema.tables where table_schema = 'app' and table_name = 'billing_accounts'" },
  { file: "0015_campaign_delete.sql", sql: "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'campaigns' and column_name = 'deleted_at'" },
  { file: "0016_activity_notifications.sql", sql: "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications'" },
  { file: "0017_announcements.sql", sql: "select 1 from information_schema.tables where table_schema = 'app' and table_name = 'announcements'" },
  { file: "0018_welcome.sql", sql: "select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'welcomed_at'" },
  { file: "0019_support.sql", sql: "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'support_tickets'" },
];

export const LATEST_MIGRATION = MARKERS.at(-1)!.file;

let cache: { at: number; missing: string[] } | null = null;

export async function missingMigrations(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.missing;
  try {
    // One round trip for every marker (matters when the database is far away).
    const missing = await withService(async (q) => {
      const sql = `select ${MARKERS.map((m, i) => `exists (${m.sql}) as m${i}`).join(", ")}`;
      const row = (await (q as unknown as Q).query<Record<string, boolean>>(sql)).rows[0] ?? {};
      return MARKERS.filter((_, i) => !row[`m${i}`]).map((m) => m.file);
    });
    cache = { at: Date.now(), missing };
    return missing;
  } catch {
    return [];
  }
}
