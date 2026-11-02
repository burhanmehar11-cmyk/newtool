# Architecture

## Today (M1)

- **Next.js 16 App Router** with Cache Components and Partial Prefetching (scaffold defaults). Every route prerenders statically. Note: with Cache Components, hidden routes stay mounted via React `<Activity>`, so transient UI (menus, drawers) closes itself in a `useLayoutEffect` cleanup, and cross-route intents go through `demo/ui.ts` rather than mount effects.
- **Marketing** (`app/(marketing)`) is mostly server components. Interactive islands: header menu, hero canvas, product tour.
- **Demo app** (`app/demo`) is client-rendered from a single store (`demo/store.ts`) built on `useSyncExternalStore` and persisted to `localStorage`. Server render uses the deterministic sample seed; the client switches to stored state after hydration.
- **Domain model** (`lib/domain/types.ts`) and **Zod schemas** (`lib/domain/schemas.ts`) are shared with M2. The brief schema is what M2 uses to validate AI output.
- **Provider contracts** (`server/providers/types.ts`): `BusinessDiscoveryProvider`, `ContactEnrichmentProvider`, `EmailVerificationProvider`, `AIProvider`, `MailboxProvider`, `BillingProvider`, with typed `Result`, `ProviderError` codes (`not_configured`, `rate_limited`…), pagination, rate limits and idempotent `UsageEvent`s. `server/providers/status.ts` reports configuration without exposing values.
- **Demo vs production separation**: everything simulated lives under `demo/` and is imported only by `features/*` screens mounted at `/demo`. Production code must never import from `demo/`; an ESLint `no-restricted-imports` rule enforces this for `server/`, `lib/`, `config/`, `jobs/` and `database/`.

The demo store already encodes rules M2 must enforce server-side (see `tests/store.test.ts`): reserve, charge and release usage; idempotent verification charges; approvals bound to a campaign revision; edits invalidate approval and pause running campaigns; eligibility re-checked before every dispatch; workspace-wide suppression that survives re-import; no duplicate active outreach; replies stop follow-ups.

## M2 plan

**Hosting and jobs.** Vercel (or similar) for the app, Supabase for Auth and Postgres, and a durable job runner (Trigger.dev is the default candidate) for discovery, enrichment, verification, scheduling and mailbox sync. Confirm the runner works with the chosen host before committing. No request-scoped loops or browser timers.

**Routes.** Authenticated product under `app/(app)/…` reusing `features/*` screens. Screens get data through a thin data-source boundary: the demo store in `/demo`, server actions and queries in the product. Production never silently reads fixtures.

**Server layout.**

```
server/
  auth/          session + workspace resolution (every call re-authorises the workspace)
  services/      leads, discovery, research, drafts, campaigns, dispatch, inbox, usage, suppression
  providers/     one real adapter per contract (+ contracts already here)
jobs/            durable tasks: discovery-page, enrich, verify, research, dispatch, mailbox-sync
database/
  migrations/    SQL migrations with RLS policies
```

**Data model (PostgreSQL, RLS on every table, `workspace_id` on every row):**
profiles, workspaces, memberships(role), offer_profiles, discovery_jobs, discovery_pages, businesses (unique per provider ref; normalized domain/address index; chains not merged by shared website), leads, contacts (unique normalized email per workspace), evidence, lists, list_memberships, tags, campaigns (revision), campaign_steps, approvals (campaign_id, revision, recipient set hash, draft versions), enrollments (state machine), drafts + draft_versions, sending_accounts (encrypted tokens), dispatches (unique per enrollment+step; provider message id; `ambiguous` state), messages, threads, suppression_entries, usage_ledger (reserve/charge/release/refund with idempotency keys), job_runs, audit_events. M3 adds plans/subscriptions/entitlements, api_keys (hashed), webhook_subscriptions and webhook_deliveries.

**Security.** Service-role key and provider credentials are server-only. URL fetching is SSRF-protected: http(s) only, DNS resolved and checked against private, link-local and metadata ranges on every redirect, bounded pages, bytes and time. Website and inbound content is untrusted data: it cannot change instructions, call tools or authorise sending. Rendered inbound HTML is sanitised. Mailbox tokens are encrypted at rest.

**Sending.** Gmail OAuth first, least privilege, separate from sign-in. The dispatcher locks a dispatch row, re-checks campaign status, approval, quota, suppression and reply state, sends with a dispatch id, and reconciles by id on timeout instead of resending. Ambiguous sends go to a review state. Pause and cancel affect queued work; an accepted in-flight message cannot be recalled.

**Replies.** Gmail push notifications (or durable polling with checkpoints), deduplicated by provider message id, threaded by provider thread id. Human reply, unsubscribe, hard bounce or manual exclusion stops follow-ups. Out-of-office replies reschedule only with a reliable return date.

## M3 plan

Billing behind `BillingProvider` with signed, deduplicated, order-tolerant webhooks; entitlements enforced server-side; owner/admin/operator/viewer roles; client workspaces; versioned REST API with hashed scoped keys, rate limits, idempotency and OpenAPI; signed outbound webhooks with delivery logs and replay; an initial MCP server reusing the service layer and authorization. No raw send tool: sending requires an approved campaign version.
