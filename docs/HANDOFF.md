# Handoff

_Last updated: 2026-11-05. M1 complete; M2 steps 1–3 built, plus Google Maps search: Google + email/password sign-in, workspaces, free OpenStreetMap search, saved leads, website research with Opportunity Briefs, free DNS email check. Landing page has the 5-step "How it works" flow._

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

- Lint and typecheck clean; 192 unit and database tests pass; production build succeeds; the smoke test passes (3 widths, no overflow, no console errors, no external requests).
- Brand renamed to Locentio. Landing page has scroll effects (`components/marketing/scroll-effects.tsx`, styles at the end of `app/globals.css`).

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

## Landing page

`components/marketing/audience-workflow.tsx` → `HowItWorks`: 5 steps (connect mailbox, search Google Maps, research and personalise, approve and launch, handle replies). Each step's badge comes from `config/milestone.ts`, so flipping a feature's `availability` updates the page.

## Next actions

1. **Google Maps** is live in production (owner confirmed 2026-11-05). Make sure the key pasted in chat during development was rotated.
2. **Gmail live check:** owner completes setup guide Part G and runs migration 0005, then Connect Gmail and send the test email.
3. **M2 step 5b: approved campaigns** (recipients + messages approval, suppression, unsubscribe, pacing via Vercel Cron).
4. **M2 step 4: evidence-based drafts.** Needs `ANTHROPIC_API_KEY`; drafts must cite brief facts only.
5. Mailbox verification provider (optional; the free DNS check stays as the floor).
6. Add a real-Postgres CI job for concurrency tests.
