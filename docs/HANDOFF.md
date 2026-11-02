# Handoff

_Last updated: 2026-11-02. M1 complete; M2 step 1 built._

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

- Schema and RLS: `database/migrations/0001_foundation.sql`. Tests: `tests/db/`.
- Auth: `server/supabase/server.ts`, `proxy.ts`, `server/auth.ts` (DAL), `server/actions/auth.ts`, `app/auth/callback/route.ts`, pages under `app/(marketing)/{sign-in,sign-up,forgot-password,reset-password}`.
- Product: `app/app/*` (overview, onboarding, settings), `server/services/workspaces.ts`, `server/actions/workspace.ts`, `components/app/product-shell.tsx`.
- Shared UI between demo and product: `features/onboarding/onboarding-wizard.tsx`, `features/settings/offer-profile-form.tsx`, `features/settings/offer-fields.tsx`.
- Lint rule: production paths cannot import `demo/*` (`eslint.config.mjs`).

## Not verified

Nothing has run against a live Supabase project yet. When credentials arrive: apply the migration, set env vars, sign up with an allowlisted email, confirm, onboard, then sign in as a second user and confirm the first workspace is invisible.

## Next action (M2 step 2)

1. Owner picks a discovery provider; check its current docs, terms, storable fields, attribution and pricing units, then implement `BusinessDiscoveryProvider`.
2. Durable job (Trigger.dev or equivalent, after a host-compatibility check) that reserves usage, pages through results, upserts `businesses`, and settles usage.
3. `/app/discover` and `/app/leads` reusing the demo screens through a data-source boundary.
4. Add a real-Postgres CI job for concurrency tests.
