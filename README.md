# Locentio

**Find the right local businesses. Start better conversations.**

Locentio is a local prospecting and outreach workspace for agencies: discover businesses by niche and location, understand why each one may need your service through a source-backed **Opportunity Brief**, and turn that research into personal, reviewed outreach.

> "Locentio" is a provisional working name. Domain and trademark availability have not been checked. Brand values live in `config/brand.ts`.

## Milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1** | Brand, landing page, interactive demo on fixture data | **Complete. Not production-ready.** |
| M2 | Accounts, persistence, real discovery, research, Gmail sending, reply sync | **In progress.** Step 1 (accounts and workspaces) built on Firebase Authentication + Cloud SQL; not yet verified against the live Google project |
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

## M2 setup: accounts and workspaces (Google Cloud)

Sign-in uses **Firebase Authentication** (email/password and Google), the database is **Cloud SQL for PostgreSQL**, and the app stays on **Vercel**, connecting through Google's Cloud SQL connector. The product lives at `/app`. Without these settings it shows a clear "not configured" state, and the demo keeps working.

**Step-by-step setup, written for Claude Cowork to follow in the browser: [docs/GOOGLE_CLOUD_SETUP.md](docs/GOOGLE_CLOUD_SETUP.md).** In short:

1. Google Cloud project with billing; enable the Cloud SQL Admin API and Identity Toolkit API.
2. Firebase on that project: enable Email/Password and Google sign-in, add your domain to authorised domains, register a web app.
3. Service account key (Firebase Admin SDK account), granted **Cloud SQL Client**.
4. Cloud SQL PostgreSQL instance with public IP and no authorised networks, plus a `locentio` database; run `database/migrations/0000_auth.sql`, then `0001_foundation.sql`.
5. Vercel environment variables (see `.env.example`), then redeploy.

How a request is authorised: the browser signs in with Firebase, posts the fresh ID token to `/api/auth/session` (same-origin, verified, recent and email-verified; first sign-in must be on `BETA_ALLOWED_EMAILS`), and receives an httpOnly session cookie. Every product query runs in a transaction as the `authenticated` role with `app.user_id` set, so row-level security limits it to the user's workspaces.

Database tests run the real migrations in PGlite (Postgres in WASM), using exactly the same user-scoping SQL as the server. `npm test` covers tenant isolation, anonymous lockout, ledger and secret protection, idempotent usage reservations, quota refusal and integrity constraints.

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
server/                  Server-only: env, Cloud SQL pool, Firebase Admin, auth (data access layer), services, actions
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

- No discovery, verification, AI, email or billing provider is connected yet (M2 steps 2–6).
- Legal pages are drafts marked for owner and legal review.
- Pricing shows "Private beta pricing coming soon". No prices are set.
- Demo data is per-browser and can be reset at any time.
