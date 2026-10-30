# VitalWatch

A website performance monitor built on the Google PageSpeed Insights API. The goal is to test sites on a schedule, keep their history, alert on real regressions and explain fixes for each site's tech stack.

The project is being built in phases, and the design is in [PLAN.md](PLAN.md).

| Phase | Scope | Status |
|---|---|---|
| 1 | Core testing | Built |
| 2 | Accounts and history | Planned |
| 3 | Scheduled monitoring and alerts | Planned |
| 4 | AI fix suggestions | Planned |
| 5 | Comparison and reports | Planned |

## What works today

- Test any public URL on mobile and desktop, with each result appearing as soon as it's ready.
- A performance score, plus real-user LCP, INP and CLS from Chrome's field data.
- Field data is labelled as page-level or site-wide, and a page with no data says so.
- Lab metrics, and opportunities ranked by estimated time saved.
- A 5-minute Redis cache, per-IP rate limiting, and retries with backoff for failures that can recover.
- Private and local addresses are rejected, including disguised forms like `http://2130706433/`.

## Tech stack

Next.js 15 (App Router), React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui, Zod, Upstash Redis and Vitest.

## Getting started

You need Node.js 20 or newer.

```bash
git clone https://github.com/sirine2907/vitalwatch.git
cd vitalwatch
npm install
cp .env.example .env.local
```

Fill in `.env.local` as described below, then run:

```bash
npm run dev
```

The app is at http://localhost:3000.

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `PAGESPEED_API_KEY` | Always | Enable "PageSpeed Insights API" in [Google Cloud](https://console.cloud.google.com/apis/credentials), then create an API key. Free. |
| `UPSTASH_REDIS_REST_URL` | In production | Create a database at [Upstash](https://console.upstash.com) and copy its REST URL. Free tier. |
| `UPSTASH_REDIS_REST_TOKEN` | In production | The REST token from the same page. |
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
| `npm test` | Runs the unit tests |
| `npm run fixtures:capture -- <urls>` | Saves real PageSpeed responses as test fixtures (needs an API key) |

## Project structure

```
src/
  app/           pages and API routes; thin, they call services
  components/    UI
  services/      use cases that coordinate everything below
  domain/        pure logic with no network or database access
  integrations/  PageSpeed Insights, Redis and rate limiting
  lib/           shared helpers
tests/           unit tests and fixtures
```

ESLint enforces the layers, so for example a component can't import an integration directly.

## Credits

Inspired by [speed-insight](https://github.com/youssefsz/speed-insight) by [@youssefsz](https://github.com/youssefsz), an MIT-licensed PageSpeed Insights front end. VitalWatch is a separate codebase that reuses ideas from it, not code.
