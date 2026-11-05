# Milestones

## M1: brand, landing page, interactive demo (complete, not production-ready)

| Acceptance check | Status | Evidence |
| --- | --- | --- |
| Install, lint, typecheck, production build pass | ✅ | `npm run check` |
| Unit tests | ✅ 57 passing | `npm test` |
| Screenshots at 390/768/1440, no horizontal overflow | ✅ | `npm run test:e2e` checks `scrollWidth` on 11 pages × 3 widths |
| Navigation, tabs, forms, table selection, drawers, draft editing, campaign preview, reset | ✅ | e2e walks the full flow |
| Keyboard: skip link, visible focus, dialogs trap focus and close on Escape | ✅ | e2e checks skip link, Escape on dialog and mobile menu; Radix manages focus |
| Demo vs live cannot be confused; no network request sends email or charges | ✅ | Persistent demo banner, "Simulate launch", sample badges; e2e fails on any external request |
| No dead primary CTAs, lorem ipsum, missing assets or console errors | ✅ | e2e fails on console or page errors |
| Metadata, favicon, social image, sitemap and robots; demo and private routes not indexed | ✅ | `app/sitemap.ts`, `app/robots.ts`, `robots: noindex` on demo, sign-in, legal and brand |

Not done in M1 (by design): real accounts, database, providers, sending, billing. A Lighthouse run was not performed; no scores are claimed.

## M2: private beta (in progress)

Build order: auth and workspaces → one real search-to-saved-lead flow → enrichment and verification → evidence-based drafts → approved Gmail sequence → reply sync and pause.

| Step | Status | Notes |
| --- | --- | --- |
| 1. Accounts and workspaces | **Built, tested offline** | Sign in with Google (OAuth code flow + PKCE, ID-token verification, invite allowlist on every sign-in), revocable server sessions, `/app` behind `proxy.ts`, workspace + offer profile onboarding, settings, usage view. Free setup: Google OAuth client + Neon Postgres via Vercel. Not yet run against the live Google client; guide in `docs/GOOGLE_CLOUD_SETUP.md`. |
| 2. Search → saved lead | **Built, tested against Postgres** | Free OpenStreetMap discovery (Nominatim + Overpass; no key, no billing). Usage reserved before and settled after; failed searches release everything. Businesses deduplicated per workspace; listing kept as evidence; public emails stored unverified; explicit "Save to leads"; `/app/discover`, `/app/leads`; ODbL attribution. Live OSM calls not run here (sandbox network blocks them). Ratings and review counts are unavailable from OSM and shown as such. |
| 3. Research and email check | **Built, tested offline** | Lead page `/app/leads/[id]`: **Research website** reads up to 3 public pages (homepage plus contact/booking/about links) with an SSRF-safe fetcher that respects robots.txt, extracts signals with sources, and builds a rule-based Opportunity Brief (no AI call; Unknowns stay Unknown). **Check email** is a free DNS check (MX records): it can say a domain can't receive email, but never marks an address "valid"; a resolver canary stops network failures from marking emails invalid. Notes per lead. Paid mailbox verification not chosen yet. Live website fetches not run here (sandbox network blocks them). |
| 3b. Google Maps listings | Not started | Official Places API only, after its docs and terms are checked (storage, caching, attribution). Needs a Google Cloud project with billing enabled (free monthly allowance) and a server-side API key. |
| 3b. Google Maps search | **Built, tested live** | Places API (New) Text Search behind a Google Maps / OpenStreetMap switch on `/app/discover`: rating and website filters, up to 60 results, results shown live with Google attribution and never stored. Saving keeps the place ID and website only; research renames the lead from its own site. Live Google details on the lead page (not stored). Global daily limit plus Google's per-day quota. Verified end to end with a real key against a local Postgres. |
| 4. AI-written drafts | **Built; MCP tested with the official client; Gemini writer tested offline** | Agent page: built-in Gemini writer (lead page "Write with AI", campaign "Write all with AI", per-recipient rewrite) and bring-your-own-agent over MCP (`/api/mcp`, 10 tools). Approval stays in the app. Gemini not yet called with a real key from here. |
| 5a. Gmail connection | **Built, tested offline** | Settings → Sending mailboxes: Connect Gmail (send-only `gmail.send`, separate consent, PKCE, nonce, granted-scope check), encrypted refresh token, from name, daily limit, test email to yourself, disconnect (revokes at Google). Not yet run against the real Gmail API from here. |
| 5b. Approved campaigns | **Built, tested offline** | /app/campaigns: create from researched leads, per-recipient messages from the brief (editable), sending days/hours/time zone, unverified-address opt-in, revision-bound approval, paced sending (scheduler or "Send next due email"), pause/resume/cancel, do-not-contact list, unsubscribe page + one-click header. First email only; follow-ups after reply sync. Not yet run against real Gmail from here. |
| 6. Reply sync | **Built, tested offline** | Optional reply tracking per mailbox (`gmail.readonly`), polling threads Locenti started; Inbox with suggested labels you can change; opt-outs and bounces go on the do-not-contact list; campaign Replies/Interested counts; "Reply in Gmail". Not yet run against a real mailbox from here. |

**Required M2 tests:**

- Done (PGlite): tenant isolation, anonymous lockout, ledger and secret write protection, idempotent usage reservation, quota refusal, duplicate active enrollment, one dispatch per step.
- Weak: quota concurrency. PGlite runs queries serially, so this checks the arithmetic, not real lock contention. Add a real-Postgres CI job (a Postgres service container).
- Still to write, per step: suppression after re-import, stale approvals, pause/reply races, ambiguous send recovery, revoked mailbox, injected research content, and the sandbox end-to-end flow.

**Blockers needing the owner:** completing `docs/GOOGLE_CLOUD_SETUP.md` (Google OAuth client, Neon database, Vercel variables, migrations up to 0004); for Gmail: Part G of the setup guide (scope, redirect URI, test users, migration 0005); for Google Maps: billing linked, Places API (New) enabled, per-day quota set, `GOOGLE_PLACES_API_KEY` in Vercel (see Part E3); for Google Maps: allowing `developers.google.com`, `cloud.google.com` and `places.googleapis.com` in this environment's network settings, plus billing on a Google Cloud project and an API key; a mailbox verification provider choice (and its terms); an Anthropic API key and model; a Google Cloud OAuth client (and verification for production scopes); a job-runner account; a test mailbox; the sender identity and business address for the beta; target markets for outreach rules.

## M3: paid launch

Started early: MCP server (see M2 step 4).


Needs owner-approved prices, trial policy, limits and billing provider eligibility before payments are enabled.
