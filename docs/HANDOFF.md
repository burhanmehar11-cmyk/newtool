# Handoff

_Last updated: 2026-11-02. M1 complete; M2 step 1 built on Google (Firebase Auth + Cloud SQL)._

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

- Schema and RLS: `database/migrations/0000_auth.sql` (roles, `auth.users`, `auth.uid()`) and `0001_foundation.sql`. Tests: `tests/db/`.
- Auth: `lib/firebase/client.ts` (browser, in-memory persistence), `app/api/auth/session/route.ts` (ID token → session cookie), `lib/session-policy.ts`, `server/firebase/admin.ts`, `server/auth.ts` (DAL), `server/actions/auth.ts`, `proxy.ts`, pages under `app/(marketing)/{sign-in,sign-up,forgot-password}`. Password reset uses Firebase's hosted page.
- Database access: `server/db.ts` (`withUser` runs as `authenticated` with `app.user_id`; `withService` for server bookkeeping), `server/db-sql.ts`.
- Product: `app/app/*` (overview, onboarding, settings), `server/services/workspaces.ts`, `server/actions/workspace.ts`, `components/app/product-shell.tsx`.
- Shared UI between demo and product: `features/onboarding/onboarding-wizard.tsx`, `features/settings/offer-profile-form.tsx`, `features/settings/offer-fields.tsx`.
- Lint rule: production paths cannot import `demo/*` (`eslint.config.mjs`).

## Not verified

Nothing has run against the live Google project yet. Follow `docs/GOOGLE_CLOUD_SETUP.md` (written for Claude Cowork), then: sign up with an allowlisted email, confirm, onboard, sign in as a second user and confirm the first workspace is invisible.

Before launch: dedicated least-privilege database user instead of `postgres`; Workload Identity Federation instead of a key file; real-Postgres CI for lock-contention tests.

## Next action (M2 step 2)

1. Owner picks a discovery provider; check its current docs, terms, storable fields, attribution and pricing units, then implement `BusinessDiscoveryProvider`.
2. Durable job (Trigger.dev or equivalent, after a host-compatibility check) that reserves usage, pages through results, upserts `businesses`, and settles usage.
3. `/app/discover` and `/app/leads` reusing the demo screens through a data-source boundary.
4. Add a real-Postgres CI job for concurrency tests.
