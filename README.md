# VitalWatch

A website performance monitor built on the Google PageSpeed Insights API. It tests your sites on a schedule, keeps their full history, alerts you when performance really drops, and suggests fixes written for your site's tech stack.

The design and the reasons behind it are in [PLAN.md](PLAN.md).

## Features

**Testing, no account needed**
- Test any public URL on mobile and desktop, with each result shown as soon as it's ready.
- A performance score, plus real-user LCP, INP and CLS from Chrome's field data, labelled as page-level or site-wide.
- Lab metrics, and opportunities ranked by estimated time saved.
- A 5-minute Redis cache, per-IP rate limits, and retries with backoff for failures that can recover.
- Private and local addresses are rejected, including disguised forms like `http://2130706433/`.

**History**
- Sign in with GitHub, or with an email link for the site owner.
- Projects group the pages of one site, up to 5 projects with 10 pages each.
- Every test is stored in Postgres: scores, metrics and trimmed raw JSON. Failed tests are stored too.
- Trend charts per page and metric over 7, 30 or 90 days, with mobile and desktop on one chart and Google's thresholds marked. A failed test shows as a gap, never as zero.

**Monitoring and alerts**
- Hourly, daily or weekly tests per project, scheduled through Upstash QStash.
- Each result is compared with the median of the last 10 tests, so one odd run doesn't move the baseline.
- Lab drops are retested 5 minutes later, and only alert if the retest agrees. Lab scores vary from run to run, and this keeps false alarms down.
- Alerts open when the score drops by more than a threshold you choose, or when a Core Web Vital becomes poor. They close on their own once the page recovers, and a problem that stays open never emails twice.
- In-app alerts feed with an unread count, plus email alerts.

**AI fix suggestions**
- Detects the site's stack from response headers, HTML markers and Lighthouse's own stack detection, with the evidence for each finding.
- Sends the failing audits and the stack to an AI model, and gets back prioritized fixes with code examples, impact and difficulty. Time savings come from Lighthouse's measurements, not from the model.
- Only audit names, measured savings, a few resource URLs and the stack names are sent. Never the page's HTML, cookies, query strings or anything about the user.
- Uses Gemini's free tier by default, or Claude if a key is set. Results are cached per test, with a daily limit per user.

**Comparison and reports**
- Compare a page with up to 3 competitors, side by side, with the best value in each row marked.
- Shareable read-only report links that expire after 7 or 30 days or never, and can be revoked. Each link shows a frozen snapshot, so it never reveals newer data than you chose to share.
- Branded PDF export using the project's own accent color.

## Tech stack

Next.js 15 (App Router), React 19, strict TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, Drizzle ORM with PostgreSQL, Auth.js, Upstash Redis and QStash, Resend, the Gemini API (with an optional Anthropic SDK adapter), react-pdf, Zod and Vitest.

**Why QStash rather than Vercel Cron:** on Vercel's free plan, cron jobs can only run once a day, and hourly monitoring needs more than that. QStash also adds retries and lets one schedule fan out into one signed job per page.

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

The app is at http://localhost:3000. Only `PAGESPEED_API_KEY` is needed for public testing.

### Running scheduled tests locally

QStash can't reach `localhost`, so in development, leave the QStash variables empty and run this while `npm run dev` is running:

```bash
npm run jobs:dispatch
```

It runs every due project's tests straight away, as a stand-in for the 15-minute schedule.

### Deploying

1. Deploy to Vercel. The free plan is fine for a portfolio project.
2. Set every variable marked "In production" below, with `APP_URL` set to the deployment's URL. Add `<APP_URL>/api/auth/callback/github` as the callback URL in your GitHub OAuth app.
3. Run `npm run db:migrate` against the production database.
4. Run `npm run jobs:schedule` once. It creates the QStash schedule that calls the dispatcher every 15 minutes, and running it again updates the schedule instead of adding a second one.

## Environment variables

All of these have a free tier except Anthropic, which is optional. `.env.example` has the details.

| Variable | Required | What it's for |
|---|---|---|
| `PAGESPEED_API_KEY` | Always | Enable "PageSpeed Insights API" in [Google Cloud](https://console.cloud.google.com/apis/credentials) and create a key |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | In production | Cache and rate limits, from [Upstash](https://console.upstash.com) |
| `DATABASE_URL` | For accounts | Pooled connection string from [Neon](https://neon.tech) or [Supabase](https://supabase.com) |
| `DATABASE_MIGRATION_URL` | No | Direct connection string, used only for migrations |
| `AUTH_SECRET` | For accounts | Generate one with `npx auth secret` |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | In production | A [GitHub OAuth app](https://github.com/settings/developers) |
| `RESEND_API_KEY` | For email | Sign-in links and alerts, from [Resend](https://resend.com/api-keys) |
| `EMAIL_OWNER_ADDRESS` | Without a domain | Your Resend account's address. Resend's test sender can only reach it, so email is limited to it |
| `EMAIL_FROM` | No | A sender on your verified domain |
| `APP_URL` | In production | The public URL, used in emails, share links and job callbacks |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | In production | Scheduling, from [QStash](https://console.upstash.com/qstash) |
| `GEMINI_API_KEY` | For AI fixes | Free key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.8-flash` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | No, paid | Use Claude instead of Gemini. Defaults to `claude-opus-5-5` |
| `AI_DAILY_LIMIT_PER_USER` | No | Defaults to 10 |
| `AUTH_URL`, `AUTH_TRUST_HOST` | With `npm start` outside Vercel | The app's URL, and `true` |

In production, the server won't serve requests until every required variable is set, and its log lists the missing ones.

## Free-tier limits

- **QStash** allows 1,000 messages a day for the whole app, so each user is limited to 100 scheduled tests a day (about 2 pages hourly, or many pages daily). The settings form explains when a change would go over.
- **Email**: without a verified domain, Resend only delivers to your own address. Other users still get alerts in the app.
- **Gemini's** free-tier limits are only shown in AI Studio. When they run out, the app says so and suggests trying later.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` / `npm start` | Builds and runs for production |
| `npm run lint` | ESLint, including the layer rules below |
| `npm run typecheck` | The TypeScript compiler |
| `npm test` | Unit and database tests |
| `npm run db:migrate` | Applies database migrations |
| `npm run db:generate` | Creates a migration after a schema change |
| `npm run jobs:dispatch` | Runs due scheduled tests locally |
| `npm run jobs:schedule` | Creates the QStash schedule after deploying |
| `npm run fixtures:capture -- <urls>` | Saves real PageSpeed responses as test fixtures |

## Testing

`npm test` runs over 300 tests, including:

- URL validation and SSRF protection
- PageSpeed parsing
- Regression detection, retests and alert lifecycles
- Stack detection
- What is and isn't sent to the AI
- Share-link security and PDF rendering

Database tests run on a real Postgres in-process, using PGlite, so they need no Docker or cloud account. Test files run one at a time, because two in-process databases at once crash on Windows.

**Not yet tested against the real services:** PageSpeed Insights responses, Upstash, Neon or Supabase, GitHub sign-in, Resend, QStash and Gemini. They were exercised end to end in a browser against local stand-ins, including a mock QStash that signs requests the same way the real one does. Run `npm run fixtures:capture` with a real key to check the parser against real data.

## Project structure

```
src/
  app/           pages and API routes; thin, they call services
  components/    UI
  services/      use cases that coordinate everything below
  domain/        pure logic with no network or database access
  data/          Drizzle schema, migrations and repositories
  integrations/  PageSpeed, Redis, QStash, Resend, AI providers, page fetcher
  lib/           shared helpers
tests/           tests and fixtures
```

ESLint enforces the layers. For example, a component can't import an integration, and a page can't query the database. Every repository read is scoped to its owner, so another user's project, test, alert or report is simply a 404.

## Credits

Inspired by [speed-insight](https://github.com/youssefsz/speed-insight) by [@youssefsz](https://github.com/youssefsz), an MIT-licensed PageSpeed Insights front end. VitalWatch is a separate codebase that reuses ideas from it, not code.
