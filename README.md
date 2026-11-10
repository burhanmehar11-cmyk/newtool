# Locenti

**Find the right local businesses. Start better conversations.**

Locenti is a local prospecting and outreach workspace for agencies: discover businesses by niche and location, understand why each one may need your service through a source-backed **Opportunity Brief**, and turn that research into personal, reviewed outreach.

> "Locenti" is a provisional working name. Domain and trademark availability have not been checked. Brand values live in `config/brand.ts`.

## Milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** | Brand, landing page, interactive demo on fixture data | **Complete. Not production-ready.** |
| M2 | Accounts, persistence, real discovery, research, Gmail sending, reply sync | **In progress.** Steps 1–3 built: sign-in (Google or email), workspaces, Google Maps search (official Places API) and free OpenStreetMap search, saved leads, website research with Opportunity Briefs, free DNS email check |
| M3 | Billing, team roles, public API, webhooks, MCP | Not started |

### What is simulated in M1

Everything in the product demo is simulated:

- **Businesses** are fictional, generated deterministically (`demo/fixtures`). Websites, emails and sources use the reserved `.example` TLD; phone numbers use the 555-01XX fiction range.
- **Search** filters fixtures locally and fakes paging and timing in the browser.
- **Research and drafts** use fixed templates (`demo/research.ts`, `demo/drafts.ts`). No AI model is called.
- **Verification** reveals pre-set outcomes after a short delay. No verifier is called.
- **Sending** uses a "demo mailbox" that delivers nothing. Launch is labelled *Simulate launch*.
- **Replies** are generated locally a few seconds after a simulated launch.
- **Usage** is a demo allowance. Nothing is billed, and pricing is "coming soon".
- **Persistence** is `localStorage` in the visitor's browser only (key `locentio.demo.v1`), with *Reset demo*.

No route makes a network request to any provider. The end-to-end smoke test blocks and fails on any request that leaves the local server.

## Getting started

Requires Node.js 20.9+ (developed on 22) and npm.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The demo lives at `/demo`. No environment variables are needed for M1.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (Next.js core-web-vitals and TypeScript rules) |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm test` | Vitest unit tests (contrast, fixtures, parser, research rules, CSV, store behaviour) |
| `npm run test:e2e` | Playwright smoke test and screenshots (needs a running server, see below) |
| `npm run check` | lint + typecheck + unit tests + build |
| `npm run brand` | Regenerates the SVG brand assets from `config/brand.ts` and `lib/brand-mark.json` |

End-to-end smoke test (uses a machine-installed Playwright, not a project dependency):

```bash
npm run build && npm start
```

```bash
BASE_URL=http://localhost:3000 npm run test:e2e
```

Screenshots land in `./screenshots` (git-ignored) at 390, 768 and 1440px.

## M2 setup: Sign in with Google (free)

Sign-in is **"Continue with Google"** through a Google OAuth client. It's free and needs no Google billing. Workspaces are stored in Postgres; the free Neon database from Vercel → Storage works. The product lives at `/app`. Without these settings it shows a clear "not configured" state, and the demo keeps working.

**Step-by-step setup, written for Claude Cowork to follow in the browser: [docs/GOOGLE_CLOUD_SETUP.md](docs/GOOGLE_CLOUD_SETUP.md).** In short:

1. Free Google Cloud project → consent screen (External, **Testing**, add test users) → OAuth client (Web) with redirect URI `https://YOUR-URL/api/auth/google/callback`.
2. Vercel → Storage → Neon (Free) → run `database/migrations/0000_auth.sql`, `0001_foundation.sql`, `0002_password_and_discovery.sql`, `0003_research.sql`, `0004_google_places.sql`, `0005_mailboxes.sql`, `0006_campaigns.sql`, `0007_agents.sql`, `0008_replies.sql`, `0009_team.sql`, `0010_followups.sql`, `0011_admin.sql`, `0012_webhooks.sql`, `0013_viewer.sql`, `0014_billing.sql`, `0015_campaign_delete.sql`, `0016_activity_notifications.sql` and `0017_announcements.sql`, in order, in Neon's SQL Editor.
3. Vercel variables: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SESSION_SECRET` (32+ characters), `NEXT_PUBLIC_SITE_URL`, `BETA_ALLOWED_EMAILS`; then redeploy.
4. Optional email + password sign-in: `SMTP_URL` (free with a Gmail App Password) for confirmation and reset emails.
5. Optional Gmail sending: same OAuth client plus the `gmail.send` scope, redirect URI `/api/gmail/callback` and test users (guide Part G).
6. Campaigns send while Locenti is open in a tab; an optional scheduler (`CRON_SECRET` + cron-job.org) keeps sending with no tab open (guide Part H).
7. Optional Google Maps search: `GOOGLE_PLACES_API_KEY` (Places API (New); free within Google's monthly allowance, billing account required). Guide Part E3.

How sign-in works:

1. `/api/auth/google/start` sends the visitor to Google with PKCE, `state` and `nonce`, requesting only `openid email profile`.
2. `/api/auth/google/callback` exchanges the code server-side, verifies the ID token against Google's keys (issuer, audience, nonce, verified email), checks `BETA_ALLOWED_EMAILS`, and records the user and a session row.
3. It then sets an httpOnly cookie holding a signed session id. Every request re-checks that session row, so signing out revokes it.
4. Product queries run in a transaction as the `authenticated` role with `app.user_id` set, so row-level security limits them to the user's workspaces.

Database tests run the real migrations in PGlite (Postgres in WASM), using exactly the SQL the server runs: user scoping, user and session bookkeeping, tenant isolation, ledger and secret protection, idempotent usage reservations and integrity constraints.

## Deploying to Vercel

`vercel.json` pins the framework to Next.js, so the project's Framework Preset can't fall back to "Other" (which serves Vercel's 404 page for every route). In the Vercel project settings, also check:

- **Root Directory** is empty (the app is at the repository root).
- **Output Directory** override is off.
- **Production Branch** matches the branch you deploy.

No environment variables are required for M1. Set `NEXT_PUBLIC_SITE_URL` to your domain for correct canonical and social-image URLs; on Vercel it otherwise falls back to the project's production URL.

## Stack

Next.js 16 (App Router, Cache Components, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Radix primitives in shadcn/ui-style components · React Hook Form + Zod · Lucide icons · Vitest. Fonts (Manrope, Inter) are bundled locally under the SIL OFL (`app/fonts`).

## Project layout

```
app/                     Routes. (marketing) = landing, auth pages, legal drafts, brand guide; demo/ = demo app; app/ = live product (M2)
database/migrations      SQL schema with row-level security
proxy.ts                 /app gate on the session cookie (Next 16 "proxy", formerly middleware)
server/                  Server-only: env, Postgres pool, auth (data access layer), services, actions
components/ui            Primitives (button, dialog/sheet, tabs, fields, toast…)
components/marketing     Landing page sections
components/product       Shared product UI (Opportunity Brief, evidence, badges)
components/app           App shell and page scaffolding
features/*               Screens: overview, discovery, leads, campaigns, inbox, settings, onboarding
demo/                    Demo-only data and logic: fixtures, parser, research/draft templates, store
lib/domain               Domain types and Zod schemas shared with M2
server/providers         Provider adapter contracts and configuration status (M2+)
config/                  Brand, plans, milestone and feature-availability flags
tests/                   Unit tests; tests/e2e/smoke.mjs
docs/                    PRODUCT, BRAND, ARCHITECTURE, MILESTONES, DECISIONS, HANDOFF
```

## Documentation

- [Product](docs/PRODUCT.md): positioning, users, workflow, principles
- [Brand](docs/BRAND.md): logo, colour, type, voice
- [Architecture](docs/ARCHITECTURE.md): current structure and the M2/M3 plan
- [Milestones](docs/MILESTONES.md): acceptance criteria and status
- [Decisions](docs/DECISIONS.md): choices and assumptions
- [Handoff](docs/HANDOFF.md): exact state and next steps

## Known limitations

- Google Maps results are shown live and not stored (Google's terms); saved Google leads keep only the place ID and website. No site-wide daily cap unless `GOOGLE_PLACES_DAILY_LIMIT` is set. Each trial/free workspace can find 200 businesses a month (`DISCOVERY_MONTHLY_LIMIT`; paid and complimentary plans and the owner's own workspace have no monthly limit).
- Email check is DNS-only and never marks an address valid. No AI, sending or billing provider is connected yet (M2 steps 4–6).
- Live OpenStreetMap and website fetches haven't been run from this development environment (its network blocks them).
- Legal pages are drafts marked for owner and legal review.
- Pricing shows "Private beta pricing coming soon". No prices are set.
- Demo data is per-browser and can be reset at any time.

## Continuous integration

`.github/workflows/ci.yml` runs lint, type checks, all tests and the production build on every push and pull request, and runs the database tests again on a real Postgres 16 (including lock-contention tests). To run them locally against your own Postgres:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npx vitest run tests/db
```
