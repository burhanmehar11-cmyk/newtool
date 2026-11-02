# Handoff

_Last updated: 2026-11-02. M1 complete; M2 steps 1–2 built: Google + email/password sign-in, workspaces, free OpenStreetMap search, saved leads._

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

- Lint and typecheck clean; 84 unit and database tests pass; production build succeeds; the smoke test passes (18 checks, 3 widths, no overflow, no console errors, no external requests).
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

## Next action (M2 step 3: research and verification)

1. Website research: SSRF-safe fetch of a few public pages per lead (homepage, contact) → evidence and signals, feeding the existing Opportunity Brief rules.
2. Email verification: choose a provider (free tiers exist; check terms) behind `EmailVerificationProvider`; until then, contacts stay "Unverified" and can't be sent to.
3. Lead detail drawer in `/app/leads` reusing the demo's brief and evidence components.
4. Add a real-Postgres CI job for concurrency tests.
