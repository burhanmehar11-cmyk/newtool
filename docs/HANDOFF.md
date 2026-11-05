# Handoff

_Last updated: 2026-11-05. M1 and M2 complete in code (see `docs/MILESTONES.md` for the live checks only the owner can run). Locenti finds local businesses on Google Maps, reads their websites for public emails and opportunities, writes personal first emails (built-in Gemini or your own agent over MCP), sends approved campaigns from Gmail, and sorts replies. Next: M3._

## State

Branch `claude/compassionate-knuth-hewpfn`. Checks:

```bash
npm run check
```

```bash
npm run build && npm start
```

```bash
BASE_URL=http://localhost:3000 npm run test:e2e
```

- Lint and typecheck clean; 273 unit and database tests pass (including the sending pass in `tests/db/dispatch.test.ts`); production build succeeds; the smoke test passes (3 widths, no overflow, no console errors, no external requests).
- Brand renamed to Locenti. Landing page has scroll effects (`components/marketing/scroll-effects.tsx`, styles at the end of `app/globals.css`).

## M2 step 1: what exists

- Schema and RLS: `database/migrations/0000_auth.sql` (roles, `auth.users`, `auth.sessions`, `auth.uid()`) and `0001_foundation.sql`. Tests: `tests/db/`.
- Auth: Google (`app/api/auth/google/*`) and email/password (`server/actions/password.ts`, `server/auth-store.ts`, `app/api/auth/verify`, pages under `app/(auth)/`), `lib/auth/` (OIDC helpers, signed tokens, constants), `server/auth.ts` (DAL), `server/actions/auth.ts` (sign-out revokes the session), `proxy.ts`, pages `app/(marketing)/sign-in` and `sign-up`.
- Database access: `server/db.ts` (`withUser` runs as `authenticated` with `app.user_id`; `withService` for user and session bookkeeping), `server/db-sql.ts` (SQL shared with tests).
- Product: `app/app/*` (overview, onboarding, settings), `server/services/workspaces.ts`, `server/actions/workspace.ts`, `components/app/product-shell.tsx`.
- Shared UI between demo and product: `features/onboarding/onboarding-wizard.tsx`, `features/settings/offer-profile-form.tsx`, `features/settings/offer-fields.tsx`.
- Lint rule: production paths cannot import `demo/*` (`eslint.config.mjs`).

## Not verified

Nothing has run against the live Google OAuth client or Neon yet. Follow `docs/GOOGLE_CLOUD_SETUP.md` (written for Claude Cowork), then sign in with a test-user Gmail account, onboard, sign in as a second user and confirm the first workspace is invisible.

Before launch: a dedicated least-privilege database role for the app; real-Postgres CI for lock-contention tests; publish the OAuth app (Audience → Publish) when opening sign-up.

## M2 step 2: what exists

- Pure helpers `lib/discovery/` (niche → OSM tags, Overpass query builder, response parsing); network calls in `server/providers/osm.ts`; persistence in `server/discovery-store.ts` (tested in `tests/db/discovery.test.ts`); service `server/services/discovery.ts`; pages `/app/discover` and `/app/leads`.
- Verified against a real Postgres (PGlite socket) in a browser: failed search releases units; results display; saving leads; overview counts; foreign job ids show nothing.
- Not verified: live OpenStreetMap calls (blocked by this sandbox's network policy). First live check: run a search on the deployed app.

## M2 step 3: what exists

- Migration `database/migrations/0003_research.sql` (research columns on `businesses`, `verification_detail` on `contacts`). **Run it in Neon** after 0002.
- Pure helpers `lib/research/`: `net-policy.ts` (public-IP check), `robots.ts`, `extract.ts` (HTML → signals, follow-up links, business emails), `aggregate.ts` (pages → signals + evidence), `brief.ts` (Opportunity Brief rules, shared with the demo), `email-check.ts` (DNS result classification).
- Network: `server/research/fetch.ts` (`safeFetch`: connect-time IP check, manual redirects, size/time limits) and `server/research/email-check.ts` (DNS check with a resolver canary).
- Persistence `server/research-store.ts`, service `server/services/research.ts`, actions `server/actions/research.ts`, page `app/app/leads/[id]/page.tsx`, buttons `features/product/lead-actions.tsx`.
- Verified in a browser against a real Postgres: lead page, research failure path (shows the error and keeps Unknowns), notes saved, unknown lead id shows "Lead not found". Not verified: research against live websites (sandbox network blocks outbound fetches).

## Google Maps search (M2 step 3b)

- Pure helpers `lib/discovery/google-places.ts` (field mask, request body, parsing, Maps link); provider `server/providers/google-places.ts` (Text Search, Place Details, global daily limit); store `saveGoogleLeads`/`savedPlaceIds` in `server/discovery-store.ts`; service `runGoogleSearch`/`saveGoogleSearchLeads`/`getGooglePlaceDetails`; UI `features/product/discover-panel.tsx` and `google-search.tsx`; migration `0004_google_places.sql`.
- Storage rule (DECISIONS #43): Google results are never stored. Saved Google leads hold the place ID and website only.
- Verified live on 2026-11-05 with a real key: search (20 Austin dentists, rating filter), save 2 leads, leads list, live details on the lead page, saved-search view, 390px layout. Website research on those leads wasn't run here (this sandbox blocks outbound website fetches).

## Gmail connection (M2 step 5a)

- Helpers `lib/gmail/oauth.ts` (consent URL, scope check) and `lib/gmail/mime.ts` (RFC 5322 message, header-injection safe, base64url raw); `server/gmail/crypto.ts` (AES-256-GCM), `server/gmail/google.ts` (token exchange/refresh, `users.messages.send`, revoke); store `server/mailbox-store.ts`; service `server/services/mailboxes.ts`; routes `app/api/gmail/start` and `app/api/gmail/callback`; UI `features/settings/mailboxes-card.tsx` (Settings → Sending mailboxes); migration `0005_mailboxes.sql`.
- Verified locally: start redirect parameters, signed-out redirect, forged/denied callbacks, settings save, unreadable token → "Needs reconnecting", disconnect deletes the token, 390px layout. **Not verified:** the real Google consent, token exchange and Gmail send (needs the deployed app with Part G done). First live check: Connect Gmail → Send test email to myself.
- Logo for Google's Branding page: `public/brand/locentio-logo-120.png`.

## Campaigns (M2 step 5b)

- Store `server/campaign-store.ts` (eligibility, create, drafts, recipients, classification, approval, status, do-not-contact) and `server/dispatch-store.ts` (service-side sending bookkeeping); services `server/services/campaigns.ts`, `server/services/dispatch.ts` (`runDispatch`), `server/services/unsubscribe.ts`; routes `app/api/cron/dispatch`, `app/api/unsubscribe/[token]`; pages `app/app/campaigns` (list + do-not-contact), `campaigns/new`, `campaigns/[id]`, public `app/unsubscribe/[token]`; UI in `features/campaigns/`; helpers `lib/campaigns/schedule.ts`, `lib/campaigns/compose.ts`; draft templates `lib/drafts/template.ts`.
- Verified in a browser against a local Postgres: sidebar links, create campaign, generated messages, edit → revision bump, unverified opt-in, approve outside sending hours (queued), send with a broken mailbox token → email put back, campaign paused, mailbox "needs reconnecting"; unsubscribe page (link alone does nothing, button suppresses and stops queued), one-click POST, cron 401 without secret, 390px layouts. **Not verified:** a real Gmail send from a campaign.

## MCP for your own AI agent (M2 step 4 / M3)

- `lib/mcp/protocol.ts` (JSON-RPC core), `server/mcp/tools.ts` (11 tools, incl. `list_replies`), `app/api/mcp/route.ts`, tokens in `server/token-store.ts` / `server/services/tokens.ts`, UI `features/settings/agents-card.tsx` (Settings → AI agents), migration `0007_agents.sql`. Services gained "as user" variants (`runGoogleSearchAs`, `saveGoogleSearchLeadsAs`, `researchLeadAs`, `getOfferProfileFor`).
- Verified with the official MCP SDK client against the running app (401 without token, all tools, live Google search, draft + campaign creation, errors).

## Built-in AI writer (Gemini)

- `lib/ai/draft-prompt.ts` (prompt + output checks, tested), `server/ai/gemini.ts`, `server/services/ai-writer.ts`, actions `server/actions/ai.ts`; UI: lead page "First email" card, campaign "Write all with AI" and per-recipient rewrite; Agent page (`app/app/agent`). Needs `GEMINI_API_KEY` (setup guide Part I). Not yet called with a real key from here.

## Reply sync (M2 step 6)

- `lib/replies/gmail-thread.ts` (parse, text only), `lib/replies/classify.ts` (suggested labels), `server/gmail/google.ts#getThread`, `server/replies-store.ts`, `server/services/replies.ts`, actions `server/actions/replies.ts`, pages `app/app/inbox` and `app/app/inbox/[id]`, migration `0008_replies.sql`. Reply tracking consent: `/api/gmail/start?replies=1`.
- Next: follow-up steps (now safe, since replies stop them) and M3.

## Team invites (M3)

- Migration `0009_team.sql`: `workspace_invites` (token SHA-256 only, 7-day expiry, one open invite per email) and security-definer functions `app.invite_member`, `app.revoke_invite`, `app.accept_invite` / `app.accept_invite_id` (signed-in email must match), `app.my_invites`, `app.set_member_role`, `app.remove_member`, `app.workspace_members`.
- `server/team-store.ts`, `server/services/team.ts`, `server/actions/team.ts`, `server/access.ts` (`mayUseLocenti`: allowlist or team invite, used by Google and password sign-in/up); UI `features/team/`, pages `app/app/team` and `app/invite/[token]`; onboarding lists open invites. Tests `tests/db/team.test.ts`.

## Follow-up emails (M3)

- `lib/campaigns/followups.ts` (rules, rendering, subject, timeline); templates stored in `campaign_steps` (positions 1–2); editor `features/campaigns/follow-ups.tsx`; `saveCampaignFollowUps` in `server/services/campaigns.ts`.
- Sending: an enrollment stays `sent` while a follow-up waits (`step` = next step, `next_send_at` = when). `nextDue` picks first emails and due follow-ups; `recordAccepted` schedules the next one and never overwrites a reply; failures on a follow-up only stop later follow-ups. Each email carries our own `Message-ID` (stored in `dispatches.rfc_message_id`); follow-ups send with Gmail `threadId` plus In-Reply-To/References. Migration `0010_followups.sql`. Tests in `tests/followups.test.ts` and `tests/db/dispatch.test.ts`.

## Admin panel (M3)

- `/admin` (`app/admin/page.tsx`, tabs in `features/admin/sections.tsx`), gated by `requireAdmin()` in `server/services/admin.ts` (`ADMIN_EMAILS`, exact emails; others get `notFound()`). Queries in `server/admin-store.ts` on the service connection; plan changes via `setPlanAction` write `app.admin_audit`.
- Sign-up sources: `components/attribution-capture.tsx` (session storage + anonymous `/api/visit` beacon), `lib/attribution.ts`, `server/attribution-store.ts`; saved at Google sign-up (short-lived cookie through the OAuth step) and password sign-up (hidden field). Migration `0011_admin.sql` (plans on `workspaces`, members can only update `name`; `app.signup_attribution`, `app.site_visits`, `app.admin_audit`). Tests `tests/attribution.test.ts`, `tests/db/admin.test.ts`.

## Public API and webhooks (M3)

- REST: `app/api/v1/[...path]/route.ts` maps routes onto the MCP tool handlers (one implementation, same validation and RLS). Docs on the Agent page (`features/agent/developers.tsx`).
- Webhooks: `lib/webhooks.ts` (events, signing, retry timing, URL rules), `server/webhook-store.ts` (endpoints, queue with per-event dedupe, claim/mark), `server/services/webhooks.ts` (`emitWebhook`, `emitLeadsCreated`, `deliverDueWebhooks`, management), `safePost` in `server/research/fetch.ts`. Emitted from lead saves, the sending pass (`email.sent`, `campaign.completed`) and reply sync; delivered by the open-tab tick and the cron route. Secrets encrypted with the mailbox-token key. Migration `0012_webhooks.sql`. Tests `tests/webhooks.test.ts`, `tests/db/webhooks.test.ts`.

## Dashboard, Analytics, migration banner

- `server/analytics-store.ts` + `server/services/analytics.ts`; UI `features/analytics/` (KPI tiles, trend chart, pipeline, campaign table, breakdowns, activity); pages `app/app/page.tsx` (Dashboard) and `app/app/analytics`.
- `server/schema-check.ts` + `features/product/schema-banner.tsx` (banner in the app layout) and `app/app/error.tsx`. When adding a migration, add its marker to `MARKERS`.

## Landing page

Order: hero with self-playing product preview (`live-demo.tsx`, ~13 s loop, pauses off-screen), sample campaign card (`proof-band.tsx` + `drafting-card.tsx`; example figures from a fictional campaign, labelled), audience strip, 5-step How it works (`audience-workflow.tsx`), AI section, product tour, reply-handling diagram (`reply-flow.tsx`), capabilities, use cases, pricing, FAQ, final CTA. App pages share `components/app/page-hero.tsx` (header with live stats) and `StepGuide`.

## Next actions

1. **Owner live checks** (listed at the end of the M2 section in `docs/MILESTONES.md`): a small real campaign, reply tracking, optional Gemini key, Google app verification, rotating the Places key.
2. **M3** (see `docs/MILESTONES.md`): team invites, follow-ups, admin panel, public API and webhooks are built (owner runs migrations up to `0012_webhooks.sql`); left: viewer role, optional real-Postgres CI, real-Postgres CI job; billing only after the owner approves prices and a provider.
3. Decide when to open sign-up (`BETA_ALLOWED_EMAILS` keeps it invite-only; the Google Maps and Gemini allowances are shared).
4. Remove the old demo code under `demo/` and the `features/*-view.tsx` demo views once nothing links to them (the marketing page still uses `demo/fixtures` for its fictional sample data).
