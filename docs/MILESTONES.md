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

## M2: private beta (next)

Order: auth and workspaces → one real search-to-saved-lead flow → enrichment and verification → evidence-based drafts → approved Gmail sequence → reply sync and pause. Done when one workspace runs the real flow with persisted data and a second workspace cannot access its records. Required tests are listed in the build brief (tenant isolation, quota concurrency, idempotent retries, duplicate enrollment, suppression after re-import, stale approvals, pause/reply races, ambiguous sends, revoked mailbox, injected research content, sandbox end-to-end).

**Blockers needing the owner:** choice of discovery and verification providers (and their terms), Supabase project, Anthropic API key and model, Google Cloud OAuth client (and verification for production scopes), job-runner account, test mailbox, sender identity and business address for the beta, target markets for outreach rules.

## M3: paid launch

Needs owner-approved prices, trial policy, limits and billing provider eligibility before payments are enabled.
