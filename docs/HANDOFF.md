# Handoff

_Last updated: 2026-11-02, end of M1._

## State

M1 is complete on branch `claude/compassionate-knuth-hewpfn`. All checks pass:

```bash
npm run check
```

```bash
npm run build && npm start
```

```bash
BASE_URL=http://localhost:3000 npm run test:e2e
```

- `npm run check`: lint clean, typecheck clean, 57 unit tests pass, production build succeeds.
- `npm run test:e2e`: 18 checks, full guided flow, 3 widths, no overflow, no console errors, no external requests.

## Where things are

- Landing: `app/(marketing)/page.tsx` → `components/marketing/*`
- Demo shell: `components/app/demo-shell.tsx`; screens: `features/*`; routes: `app/demo/*`
- Demo logic: `demo/store.ts` (actions), `demo/selectors.ts` (eligibility, usage, metrics), `demo/seed.ts`
- Contracts for M2: `lib/domain/*`, `server/providers/*`
- Flags: `config/milestone.ts` (`SIGNUP_OPEN`, `PRICING_LIVE`, feature availability), `config/plans.ts`, `config/brand.ts`

## Known issues and notes

- Screenshots in the smoke test capture the menu after a 400ms wait; animations are 160–240ms.
- `next dev` rewrites `AGENTS.md` (managed Next.js block). Committing it keeps the tree clean.
- No Lighthouse or Core Web Vitals measurements have been taken yet.

## Next action (M2, step 1)

1. Owner provides: Supabase project, Anthropic key, Google OAuth client, choice of discovery and verification providers, job-runner account.
2. Add Supabase Auth and the `profiles`, `workspaces`, `memberships` migrations with RLS, then protected `app/(app)` routes reusing `features/*` through a data-source boundary.
3. Keep the existing lint rule (`eslint.config.mjs`) that forbids importing `demo/*` from `server/`, `lib/`, `config/`, `jobs/` and `database/`; extend it to the new `app/(app)` routes.
4. Flip `SIGNUP_OPEN` only when trial entitlements work.
