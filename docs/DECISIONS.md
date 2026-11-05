# Decisions and assumptions

Reversible choices made without asking, with the reason. Revisit any of them freely.

| # | Decision | Why |
| --- | --- | --- |
| 1 | Next.js **16.4.3** (not 16.4.4, released on the day of the build), React 19.3, Tailwind 4, exact-pinned libraries at least ~2 weeks old | Current supported stable versions with a short soak period. Lockfile committed. |
| 2 | Kept the scaffold's **Cache Components + Partial Prefetching** | They are the defaults in this Next version and everything prerenders. Activity-preserved routes are handled explicitly (see ARCHITECTURE). |
| 3 | shadcn/ui **patterns** written by hand on the unified `radix-ui` package instead of running the shadcn CLI | Same accessible primitives and copy-in ownership, with no network-dependent generator and full visual control. |
| 4 | Fonts bundled from Fontsource (OFL) via `next/font/local` | No build-time network dependency; licence files included. |
| 5 | Demo state in `localStorage`, isolated under `/demo` with a persistent banner | The brief requires persistence across refresh with no backend in M1. |
| 6 | Deterministic generated fixtures (376 fictional businesses, 8 niches, 5 US cities) with hand-tuned featured leads | Realistic variety without hand-writing hundreds of records; stable across server and client renders. |
| 7 | Only **role addresses** (info@, hello@) in fixtures; no named contacts | Consistent with "never fabricate owners". The brief shows the decision-maker as Unknown. |
| 8 | Fit rubric: weighted criteria per offer type; strong ≥60% of total points, moderate ≥35%; Unknown criteria score 0 and lower confidence | Transparent and explainable; missing data can't inflate fit. Thresholds are tunable. |
| 9 | Catch-all and unknown addresses excluded by default with a per-campaign policy switch | Matches the brief; reduces bounces. |
| 10 | Usage units: 1 discovery unit per business returned, 1 verification unit per address, 1 AI unit per brief, draft or suggested reply | Simple, explainable placeholders until real provider costs are known (M3 cost model). |
| 11 | Added tokens **Fog** `#93A4AD` (secondary text on dark) and **Control border** `#7C8D87` (inputs, 3:1) and a sand **demo** tone | Needed for contrast compliance and to keep demo labels visually distinct from brand mint. |
| 12 | Legal pages are outlines with [placeholders] and a "Draft, not in effect" banner | No company identity has been provided; no compliance claims are made. |
| 13 | Sign in page explains that accounts open with the private beta | Avoids a dead CTA and avoids implying signup exists. `SIGNUP_OPEN` flips the header CTA in M2. |
| 14 | Planned M2 providers: ~~Supabase~~ Google Cloud (see #25), Trigger.dev (jobs, pending host compatibility check), Anthropic (AI, model via `ANTHROPIC_MODEL`), Gmail first | Per the brief; no discovery or verification vendor chosen yet: that needs a terms and pricing review. |
| 15 | No open tracking planned for the beta | Not needed for the core value; avoids privacy and deliverability issues. |

## Open questions for the owner

- Final product name and domain.
- Which discovery and verification providers to evaluate first (budget, markets).
- Target markets for outreach (affects sender identity, address and opt-out requirements).
- Support email and legal entity details for the footer and legal pages.

## M2 decisions

| # | Decision | Why |
| --- | --- | --- |
| 16 | Sign-up gated by `BETA_ALLOWED_EMAILS` (emails or @domains); `SIGNUP_OPEN` stays false | Private beta without trial entitlements; the marketing CTA stays "Explore demo". |
| 17 | Businesses, contacts and evidence are stored **per workspace**, not shared | Provider terms may restrict sharing and retention, and tenants must never see each other's data. Chains are not merged on a shared domain. |
| 18 | Callable functions (`create_workspace`, `reserve_usage`, `settle_usage`) live in `public`, helpers in `app`; EXECUTE is revoked from `public`/`anon` | Postgres grants EXECUTE to everyone by default. |
| 19 | Usage ledger, allowances, audit events and job runs are read-only to members; writes go through SECURITY DEFINER functions or the service role | Clients can't edit what they're charged. |
| 20 | Mailbox tokens live in `sending_account_secrets` with RLS on and no policies | Only the service role can read them. |
| 21 | Session = httpOnly cookie with an HS256-signed session id (7 days); the `auth.sessions` row is checked on every request; sign-out revokes the row | Cookie contents alone are never trusted, and sessions are revocable server-side. |
| 22 | Active workspace is an httpOnly cookie, always re-validated against memberships | Switching is cheap; a forged cookie gives nothing. |
| 23 | Database tests run the real migrations in PGlite with the server's own user-scoping SQL | Real Postgres and RLS semantics without a hosted project in CI. Concurrency still needs a real-Postgres job. |
| 24 | Brand renamed to **Locentio** (owner request) | Still provisional; trademark and domain not checked. |
| 25 | ~~Firebase Authentication + Cloud SQL~~ superseded by #29 | — |
| 26 | ~~Cloud SQL connector~~ superseded by #29 | — |
| 27 | Provider subjects (`google:<sub>`) map to internal UUIDs in `auth.users`; queries run as role `authenticated` with `app.user_id` set per transaction | RLS stays database-enforced and independent of the sign-in provider. |
| 28 | ~~Service account key~~ no longer needed (#29) | — |
| 29 | **Free stack (owner decision): Sign in with Google via our own OAuth client, plus Postgres on Vercel's free Neon plan.** No Firebase, no Cloud SQL, no Google billing | The owner wants no paid services. Basic `openid email profile` scopes are free and need no Google verification. Testing mode with test users suits the private beta. The same OAuth client is reused for Gmail sending later. |
| 30 | OAuth implemented directly (authorization code + PKCE, `state` and `nonce` in a signed 10-minute cookie, ID token verified with `jose` against Google's JWKS) | Small and auditable, with no auth vendor. |
| 31 | `BETA_ALLOWED_EMAILS` is checked on **every** sign-in, not only the first | Removing someone from the list takes effect at their next sign-in. |
| 32 | **Email + password sign-in added alongside Google** (owner request): scrypt hashes, email verification required, single-use hashed tokens (24 h verify, 1 h reset), throttling after 8 failures in 15 minutes, generic messages so the forms don't reveal which emails exist | Some invitees prefer a password. Every safety property matches the Google path. |
| 33 | Same email = same account. Google links to a password account only if its email was verified; an unverified password account is taken over by Google and its password cleared | Prevents someone pre-registering another person's email to keep access later. |
| 34 | Transactional email over SMTP (free: Gmail App Password); optional | No paid email provider. Without it, Google sign-in still works. |
| 35 | **Discovery uses OpenStreetMap** (Nominatim for places, Overpass for businesses) | Free, no key, no billing, worldwide, open licence (ODbL) that allows storing results with attribution. Trade-offs: no ratings or reviews, uneven coverage, fair-use limits on the public servers. `NOMINATIM_URL`/`OVERPASS_URL` can point to self-hosted or paid instances later. |
| 36 | Searches run as one bounded server request (≈10 s place lookup + ≈30 s business query), not a background job | A single OSM query fits in a request. A durable job runner arrives with multi-step work (website research, sending). |
| 37 | `DB_POOL_MAX` (default 3) controls connections per server instance | Fits Neon's free connection limits; also used by tests. |
| 38 | Website research reads at most 3 pages per lead within 20 s, only on ports 80/443, re-checking that every resolved IP is public at connect time, following at most 3 redirects, with size limits; robots.txt is obeyed (a missing robots.txt allows, any other robots error stops the research) | Fetching arbitrary URLs from a server is an SSRF risk, and site owners' crawl rules must be respected. |
| 39 | Research produces facts only from what the pages show; `onlineBooking` is `false` only when the site explicitly asks visitors to call, otherwise Unknown. Briefs are labelled "rule-based, no AI call" (`generator: "template"`) | Never invent issues. Missing evidence is Unknown, not a negative finding. |
| 40 | The free email check is DNS-only (MX, null MX, A fallback). It can return "invalid" (domain can't receive mail) or "unknown", never "valid". A DNS canary (gmail.com MX) must resolve first, and paid-provider results are never overwritten by it | MX records prove nothing about a mailbox. A broken resolver must not mark real addresses invalid. |
| 41 | Google Maps search uses the official **Places API (New)** Text Search; Google Maps is never scraped | Free within Google's per-SKU monthly allowance (a billing account is still required). Places returns no emails; contacts come from website research. |
| 42 | Landing "How it works" is a 5-step flow (connect mailbox → search Google Maps → research and personalise → approve and launch → handle replies), with each step's status badge read from `config/milestone.ts` | Owner asked for this workflow; badges keep the page from claiming features that aren't live. |
| 43 | **Google results are shown live and never stored.** A saved Google lead keeps only the place ID (allowed indefinitely by Service Specific Terms §3) and the business's own website URL; its name starts as the domain and becomes the name the website gives itself (og:site_name or title) after research. Google details on a lead page are fetched on request and not stored. CSV export never includes Google content | Google Maps Platform Terms 3.2.3: no caching except as the Service Specific Terms allow (place IDs; coordinates up to 30 days), and "copy and save business names, addresses, or user reviews" is prohibited. Read from cloud.google.com on 2026-11-05. **Judgment call for owner/legal review:** we treat the website URL as the business's own identifier rather than Google content. |
| 44 | Text Search requests `websiteUri`, phone and rating (Enterprise tier, 1,000 free/month) rather than the cheaper Pro tier | Without the website there's nothing to research and no email to find. Each request returns up to 20 places, so ~20,000 businesses a month fit in the free allowance. |
| 45 | A global daily counter (`app.provider_daily_calls`, `GOOGLE_PLACES_DAILY_LIMIT`, default 30) gates every Google call, on top of Google's own per-day quota | One API key serves every workspace; the limit keeps usage inside the free allowance even if the Cloud quota wasn't set. 30 × 31 days < 1,000. |
| 46 | Attribution: "Results from Google Maps" text under every Google result view | Places content shown without a Google map needs Google attribution. Google's policy page (developers.google.com) couldn't be loaded from here; replace with the official logo asset if that page requires it. |
| 47 | Overpass requests try three public instances in order (overpass-api.de, overpass.private.coffee, maps.mail.ru), moving on after a 406, 429 or 5xx, within a 45 s budget; browser-style Accept header and a Referer | The main instance began answering some deployed searches with HTTP 406 (seen in production, 2026-11-05). A 400 isn't retried. `OVERPASS_URL` can list other instances. |
