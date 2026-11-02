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
| 1. Accounts and workspaces | **Built, tested offline** | Supabase Auth (sign-up by allowlist, sign-in, reset, sign-out), `/app` behind `proxy.ts`, workspace + offer profile onboarding, settings, usage view. Full schema with RLS in `database/migrations/0001_foundation.sql`. Not yet run against a live Supabase project. |
| 2. Search → saved lead | Not started | Needs a discovery provider decision and key. |
| 3. Enrichment and verification | Not started | Needs a verification provider decision and key; SSRF-safe crawler. |
| 4. Evidence-based drafts | Not started | Needs `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. |
| 5. Approved Gmail sequence | Not started | Needs a Google OAuth client and a test mailbox; durable job runner. |
| 6. Reply sync and pause | Not started | Gmail push or durable polling. |

**Required M2 tests:**

- Done (PGlite): tenant isolation, anonymous lockout, ledger and secret write protection, idempotent usage reservation, quota refusal, duplicate active enrollment, one dispatch per step.
- Weak: quota concurrency. PGlite runs queries serially, so this checks the arithmetic, not real lock contention. Add a real-Postgres CI job (Supabase CLI or a Postgres service container).
- Still to write, per step: suppression after re-import, stale approvals, pause/reply races, ambiguous send recovery, revoked mailbox, injected research content, and the sandbox end-to-end flow.

**Blockers needing the owner:** a Supabase project; a choice of discovery and verification providers (and their terms); an Anthropic API key and model; a Google Cloud OAuth client (and verification for production scopes); a job-runner account; a test mailbox; the sender identity and business address for the beta; target markets for outreach rules.

## M3: paid launch

Needs owner-approved prices, trial policy, limits and billing provider eligibility before payments are enabled.
