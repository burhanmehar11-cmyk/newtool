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

## M2: the working product (complete in code; live checks listed below)

Build order: auth and workspaces → one real search-to-saved-lead flow → enrichment and verification → evidence-based drafts → approved Gmail sequence → reply sync and pause. All steps are built and covered by unit and database tests.

| Step | Status | Notes |
| --- | --- | --- |
| 1. Accounts and workspaces | **Built, live** | Sign in with Google (OAuth code flow + PKCE, ID-token verification, invite allowlist on every sign-in) and email/password, revocable server sessions, `/app` behind `proxy.ts`, workspace + offer profile onboarding, settings, usage view. Running in production on Vercel + Neon. |
| 2. Search → saved lead | **Built, tested against Postgres** | Free OpenStreetMap discovery as a fallback (Nominatim + Overpass; no key). Usage reserved before and settled after; failed searches release everything. Businesses deduplicated per workspace; explicit "Save to leads"; ODbL attribution. |
| 3. Research and email check | **Built, tested offline** | Lead page **Research website** reads up to 3 public pages with an SSRF-safe fetcher that respects robots.txt and builds a rule-based Opportunity Brief (Unknowns stay Unknown). **Check email** is a free DNS (MX) check; it never marks an address "valid". Live website fetches can't run in this sandbox. |
| 3b. Google Maps search | **Built, live** | Places API (New) Text Search: free-text business type, Country → State → City, rating and website filters, up to 60 results shown live with Google attribution and never stored (only place IDs and websites are kept). Global daily limit plus Google's per-day quota. Owner confirmed it working in production. |
| 3c. Emails for leads | **Built, tested offline** | Public emails read from each result's own website right after a search (homepage then contact pages), "Only with email" filter, "Find missing emails" on Leads. Never guessed, shown as unverified, kept with the page they came from. |
| 4. AI-written drafts | **Built; MCP tested with the official client; Gemini tested offline** | Built-in Gemini writer (lead page, campaign "Write all", per-recipient rewrite) using brief facts only, with prompt-injection guards and output checks; bring-your-own agent over MCP (`/api/mcp`, 10 tools, personal tokens). Approval stays in the app. Needs `GEMINI_API_KEY` (optional). |
| 5a. Gmail connection | **Built, live** | Mailboxes page: Connect Gmail (`gmail.send`, PKCE, nonce, granted-scope check) reusing the sign-in OAuth client, encrypted refresh token, from name, daily limit, test email, disconnect (revokes at Google). Owner connected a mailbox in production. |
| 5b. Approved campaigns | **Built, tested against Postgres** | Create from leads with an email, per-recipient emails (editable), sending days/hours/time zone, revision-bound approval, paced sending (one per mailbox per pass, 3 minutes apart, daily cap) from open app tabs or the optional `/api/cron/dispatch`, pause/resume/cancel, do-not-contact list, unsubscribe page + one-click header. First email only; follow-ups are M3. |
| 6. Reply sync | **Built, tested offline** | Optional reply tracking per mailbox (`gmail.readonly`), reading only threads Locenti started; Inbox with suggested labels you can change; opt-outs and bounces go on the do-not-contact list; replies stop outreach; campaign Replies/Interested counts. |
| 7. Dashboard and Analytics | **Built** | Lead-first dashboard and analytics from real records only (no sample numbers in the app); outreach tab; migration banner. |

**M2 tests (all in `npm test`):**

- Database (PGlite, real migrations): tenant isolation, anonymous lockout, ledger and secret write protection, idempotent usage reservation, quota refusal, duplicate active enrollment, one dispatch per step, stale approvals, suppression on re-import and after approval, MCP tokens, reply storage.
- Sending pass (`tests/db/dispatch.test.ts`, Gmail stubbed): spacing and unsubscribe headers, ambiguous sends never retried and counted against the daily limit, revoked mailbox and failed token refresh pause the campaign and keep the email queued, a rejected email stops only that recipient, pause/resume, a reply before someone's turn, the do-not-contact list re-checked at send time, sending window.
- Injected website content: AI prompt guards and output checks (`tests/ai-draft.test.ts`); website research is rule-based (no AI), so text on a page is only ever matched as data.
- Known limit: quota concurrency on PGlite checks the arithmetic, not real lock contention (PGlite runs one query at a time). A real-Postgres CI job is listed under M3.

**Live checks only the owner can run** (code is done; these need real accounts):

- Send a small campaign to your own second address and watch it go out with Locenti open.
- Turn on reply tracking (add `gmail.readonly` and a test user), reply from the other address, then click "Check for replies".
- Optional: add `GEMINI_API_KEY` and try "Write with AI".
- Google app verification: Search Console ownership (`GOOGLE_SITE_VERIFICATION`), then submit without `gmail.readonly` (that scope needs a CASA assessment).
- Rotate the Places API key that was pasted in chat during development.

## M3: paid launch

Started early: MCP server (see M2 step 4).


Needs owner-approved prices, trial policy, limits and billing provider eligibility before payments are enabled.
