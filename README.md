# VitalWatch

A website performance monitor built on the Google PageSpeed Insights API. The goal is to test sites on a schedule, keep their history, alert on real regressions and explain fixes for each site's tech stack.

The project is being built in phases, and the design is in [PLAN.md](PLAN.md).

| Phase | Scope | Status |
|---|---|---|
| 1 | Core testing | Built |
| 2 | Accounts and history | Built |
| 3 | Scheduled monitoring and alerts | Planned |
| 4 | AI fix suggestions | Planned |
| 5 | Comparison and reports | Planned |

## What works today

**Public testing, no account needed**
- Test any public URL on mobile and desktop, with each result appearing as soon as it's ready.
- A performance score, plus real-user LCP, INP and CLS from Chrome's field data.
- Field data is labelled as page-level or site-wide, and a page with no data says so.
- Lab metrics, and opportunities ranked by estimated time saved.
- A 5-minute Redis cache, per-IP rate limiting, and retries with backoff for failures that can recover.
- Private and local addresses are rejected, including disguised forms like `http://2130706433/`.

**With an account**
- Sign in with GitHub, or with an email link for the site owner.
- Projects that group the pages of one site, up to 5 projects with 10 URLs each.
- Every test is stored in Postgres: scores, metrics and trimmed raw JSON. Failures are stored too.
- Trend charts per URL and metric over 7, 30 or 90 days, with mobile and desktop on one chart and published thresholds marked. A failed test shows as a gap, never as zero.
- Data is scoped to its owner in the data layer, so another user's page is simply a 404.

## Tech stack

Next.js 15 (App Router), React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, Drizzle ORM with PostgreSQL, Auth.js, Upstash Redis, Resend, Zod and Vitest. Tests run against real Postgres in-process using PGlite, so they don't need Docker or a cloud database.

## Getting started

You need Node.js 20.12 or newer.

```bash
git clone https://github.com/sirine2907/vitalwatch.git
cd vitalwatch
npm install
cp .env.example .env.local
```

Fill in `.env.local` as described below, then create the database tables and start the app:

```bash
npm run db:migrate
npm run dev
```

The app is at http://localhost:3000. Only `PAGESPEED_API_KEY` is needed for public testing, and you can skip `db:migrate` until you want accounts.

## Environment variables

All of these services have a free tier. `.env.example` has the details.

| Variable | Required | Where to get it |
|---|---|---|
| `PAGESPEED_API_KEY` | Always | Enable "PageSpeed Insights API" in [Google Cloud](https://console.cloud.google.com/apis/credentials), then create an API key. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | In production | Create a database at [Upstash](https://console.upstash.com) and copy its REST details. |
| `DATABASE_URL` | For accounts | The pooled connection string from [Neon](https://neon.tech) or [Supabase](https://supabase.com). |
| `DATABASE_MIGRATION_URL` | No | The direct connection string, used only for migrations. |
| `AUTH_SECRET` | For accounts | Generate one with `npx auth secret`. |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | In production | Create an [OAuth app](https://github.com/settings/developers) with the callback URL `http://localhost:3000/api/auth/callback/github`. |
| `RESEND_API_KEY` | For email sign-in | Create a key at [Resend](https://resend.com/api-keys). |
| `EMAIL_OWNER_ADDRESS` | Without a domain | Your Resend account's address. Limits email to it, because Resend's test sender can't reach anyone else. |
| `EMAIL_FROM` | No | A sender on your verified domain. |
| `AUTH_URL`, `AUTH_TRUST_HOST` | With `npm start` outside Vercel | The app's URL, and `true`. |
| `PAGESPEED_API_URL` | No | Points the app at a mock PageSpeed server for local testing. |

Without Upstash in development, caching and rate limiting switch off and the server logs a warning. In production, the server won't serve requests until all required variables are set, and it logs which ones are missing.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Builds for production |
| `npm start` | Runs the production build |
| `npm run lint` | Runs ESLint, including the layer rules below |
| `npm run typecheck` | Runs the TypeScript compiler |
| `npm test` | Runs the tests |
| `npm run db:migrate` | Applies database migrations |
| `npm run db:generate` | Creates a migration after a schema change |
| `npm run db:studio` | Opens a database browser |
| `npm run fixtures:capture -- <urls>` | Saves real PageSpeed responses as test fixtures (needs an API key) |

## Project structure

```
src/
  app/           pages and API routes; thin, they call services
  components/    UI
  services/      use cases that coordinate everything below
  domain/        pure logic with no network or database access
  data/          Drizzle schema, migrations and repositories
  integrations/  PageSpeed Insights, Redis, rate limiting and email
  lib/           shared helpers
tests/           tests and fixtures
```

ESLint enforces the layers, so for example a component can't import an integration and a page can't query the database.

## Credits

Inspired by [speed-insight](https://github.com/youssefsz/speed-insight) by [@youssefsz](https://github.com/youssefsz), an MIT-licensed PageSpeed Insights front end. VitalWatch is a separate codebase that reuses ideas from it, not code.
