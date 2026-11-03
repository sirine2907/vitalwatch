# VitalWatch: Plan

VitalWatch tests websites on a schedule, keeps their performance history, alerts on real regressions, and uses AI to explain fixes for each site's tech stack.

**Status:** all five phases are built. None has been run against the real cloud services yet; see the README's testing section.

Versions and limits below were checked on 2026-10-30.

---

## 1. Decisions

| Area | Decision | Why |
|---|---|---|
| Framework | Next.js **15.5.x**, React 19, strict TypeScript | You asked for 15. The current major is 16, and I won't upgrade unless you ask. |
| Scheduler | **Upstash QStash** | See 1.1. |
| Database driver | Drizzle with `postgres` (postgres.js) | The same driver works on Neon and Supabase, so switching only means changing `DATABASE_URL`. Prepared statements are off so it works with pooled connections. |
| Auth | Auth.js through `next-auth@5` with the Drizzle adapter, using database sessions | v5 is the App Router version but is still tagged **beta** (`5.0.0-beta.32`), so I'll pin the exact version. |
| Validation | Zod at every boundary: forms, routes, env vars, PSI responses and LLM output | PSI responses vary by site, and a bad one should fail clearly instead of saving nulls. |
| Charts | Recharts through shadcn's chart component | I'll install the Recharts version that component supports at setup time, which may not be the latest. |
| PDF | `@react-pdf/renderer` | It runs without headless Chromium, which is heavy and fragile on serverless. |
| Budget | **$0**: portfolio project on free tiers only | Every service must work without a card. Free-tier limits are shown in the demo rather than worked around. |
| AI | **Gemini API free tier** by default, behind an `LlmProvider` interface, with Anthropic as an optional adapter | The Anthropic API has no free tier. Keeping the interface means Claude works if a key is ever added, with no other code changes. Output is validated with Zod either way. |
| Tests | Vitest for logic, PGlite for repositories | PGlite is Postgres in-process, so tests need neither Docker nor a cloud database. |
| Package manager | npm | It is already set up on this machine, with its cache on D:. |

### 1.1 Scheduler: QStash, not Vercel Cron

| | Vercel Cron (Hobby) | QStash (free) |
|---|---|---|
| Fastest schedule | **Once a day**: hourly expressions fail at deploy | Per minute |
| Precision | ±59 minutes | Per minute |
| Retries on failure | None built in, I'd write them | Built in, with backoff |
| Fan-out to one job per URL | I'd build it | Publishing one message per job |
| Works off Vercel | No | Yes |

Hourly monitoring is a requirement, and Vercel Cron on Hobby can't do it. Pro can, but it is paid and still leaves retries and fan-out for me to build.

**QStash's limits shape the design.** The free tier allows 10 active schedules and 1,000 messages a day, and retries count as messages. So there is **one** schedule rather than one per project:

```
QStash schedule (every 15 min) -> POST /api/jobs/dispatch
    finds projects with next_run_at <= now, moves next_run_at forward in the same transaction
    publishes one message per URL + strategy
        -> POST /api/jobs/run-test (signature checked, runs PSI, saves, evaluates)
```

**Free-tier capacity:** the dispatcher uses 96 messages a day, leaving about 900. An hourly URL tested on mobile and desktop uses 48 a day, so that's **about 18 hourly URLs** or about 450 daily ones, before retries and retests. Pay-as-you-go is $1 per 100K messages.

---

## 2. Lessons from existing PageSpeed tools

Before building, I studied how a typical open-source PageSpeed Insights front end calls the API and shows results. VitalWatch reuses some of its ideas, but none of its code.

**Ideas worth reusing**
- Keep the PSI key behind a server-side route.
- Run mobile and desktop as separate requests, so one can show while the other is still loading.
- Show each vital's good / needs-work / poor distribution as a segmented bar.
- Rewrite PSI errors as helpful messages.

**What I'll do differently**

| Typical approach | VitalWatch | Why it matters |
|---|---|---|
| Rate limits in an in-memory `Map` on the edge runtime | Upstash Redis | The `Map` is per instance, so limits barely apply on serverless. |
| Trusts `cf-connecting-ip` and `x-real-ip` first | Uses only the header the host sets | Clients can forge these headers and dodge the limit. |
| Caching through `Cache-Control` only | Redis cache keyed by normalized URL + strategy | Saves PSI quota whichever client or route asks. |
| Fetches have no timeout | `AbortSignal` timeout, with retries only on 429/5xx/network errors and jittered backoff | A hung PSI call would otherwise use up the whole function time. |
| Any URL with a 3+ character hostname is accepted | Also rejects localhost, private IPs, credentials in URLs and non-standard ports | See section 7. |
| Uses `loadingExperience` only | Also reads `originLoadingExperience` and `origin_fallback`, and labels the scope | Low-traffic pages otherwise look like they have no data, or show origin data as if it were the page's. |
| Doesn't check `runtimeError` | Treats it as a failed run | Google's docs say such results may need discarding. A bad score could otherwise trigger a false alert. |
| Keeps responses in client state, with one 1,000+ line page | Layered services with stored runs | Needed for history. |

The current docs list the host as `pagespeedonline.googleapis.com` with uppercase strategy values. Existing tools often use `www.googleapis.com` and lowercase. I'll follow the docs and confirm with a live call in Phase 1.

---

## 3. Architecture

```
app/ (pages, route handlers, server actions)     thin: parse input, check auth, call a service
        |
services/ (use cases)                            orchestration; no SQL and no JSX
        |
   +----+-----------------+
   |                      |
domain/                 data/ and integrations/
pure logic, no I/O      repositories, PSI, Redis, QStash, Resend, LLM
most tests live here    all network and database access
```

Three rules, enforced with an ESLint `no-restricted-imports` rule:
1. `domain/` imports nothing from the other layers.
2. Only `data/` touches Drizzle.
3. `components/` never imports `data/` or `integrations/`.

**Ownership checks live in repositories.** Reads take a `userId`, so a route that forgets a check can't return another user's project.

### Folder structure

```
src/
  app/
    (marketing)/page.tsx            URL input
    analyze/page.tsx                results (public)
    (auth)/sign-in/
    (dashboard)/
      projects/ projects/[id]/ projects/[id]/urls/[urlId]/
      projects/[id]/compare/ projects/[id]/settings/
      alerts/
    r/[token]/page.tsx              shared read-only report
    api/
      analyze/                      public analysis
      auth/[...nextauth]/
      jobs/dispatch/ jobs/run-test/ QStash only, signature checked
      runs/[id]/suggestions/        AI fixes
      reports/[token]/pdf/
  components/
    ui/                             shadcn
    results/ charts/ projects/ alerts/ reports/
  domain/
    url/validate.ts
    psi/parse.ts psi/trim.ts
    vitals/thresholds.ts
    regression/baseline.ts regression/detect.ts
    stack/detect.ts
    schedule/next-run.ts
  services/
    analysis.service.ts  run.service.ts  monitoring.service.ts
    alert.service.ts  suggestion.service.ts  report.service.ts
  data/
    schema.ts  db.ts  migrations/
    repositories/
  integrations/
    psi.client.ts  redis.ts  rate-limit.ts  qstash.ts
    resend.ts  site-fetcher.ts
    llm/provider.ts  llm/gemini.ts  llm/anthropic.ts
  lib/
    env.ts  errors.ts  retry.ts
tests/                              fixtures of real PSI responses
```

---

## 4. Database schema

Auth.js's standard tables (`users`, `accounts`, `sessions`, `verification_tokens`) are also included. All IDs are UUIDs and all timestamps are `timestamptz`.

This is the target schema. Each phase's migration adds only the columns and tables that phase uses. One change from this design: `project_urls` has a single `url` column holding the normalized form, since nothing needs the text as typed.

```
projects
  id, user_id -> users (cascade), name
  schedule               enum off | hourly | daily | weekly   default off
  next_run_at            nullable; indexed where schedule <> off
  score_drop_threshold   int, default 10    the "X points"
  baseline_size          int, default 10
  email_alerts           bool, default true
  brand_color, brand_logo_url   nullable (Phase 5)

project_urls
  id, project_id -> projects (cascade)
  url, normalized_url, label
  role                   enum monitored | competitor
  unique (project_id, normalized_url)

test_runs                one row per URL + strategy
  id, url_id -> project_urls (cascade)
  strategy               enum mobile | desktop
  status                 enum pending | success | failed
  trigger                enum manual | scheduled | retest
  slot                   timestamptz, nullable; the schedule slot
  performance_score      int
  lab_lcp_ms, lab_fcp_ms, lab_tbt_ms, lab_si_ms, lab_ttfb_ms, lab_cls
  field_lcp_ms, field_inp_ms, field_cls
  field_scope            enum url | origin | none
  lighthouse_version, final_url, error
  raw                    jsonb, trimmed
  created_at, completed_at
  index (url_id, strategy, created_at desc)
  unique (url_id, strategy, slot, trigger)    a redelivered job can't double-run

alerts
  id, project_id, url_id, trigger_run_id -> test_runs
  type                   enum score_drop | vital_poor
  metric                 nullable: lcp | inp | cls
  strategy, baseline_value, current_value, threshold
  status                 enum open | resolved
  read_at, emailed_at, created_at, resolved_at
  unique index on (url_id, strategy, type, metric) where status = 'open'

stack_detections
  id, url_id, detected   jsonb [{ name, category, confidence, evidence[] }]
  run_id, created_at

ai_suggestions
  id, run_id -> test_runs (cascade), prompt_version, model
  content                jsonb, Zod-validated
  input_tokens, output_tokens, created_at
  unique (run_id, prompt_version)             the per-run cache

shared_reports
  id, project_id, created_by
  token_hash             unique; the raw token is shown only once
  snapshot               jsonb, frozen at creation
  expires_at, revoked_at, created_at
```

**Choices worth reviewing**
- **Metrics are real columns** with the raw JSON beside them, so charts never have to parse JSON.
- **`raw` drops** screenshots, `i18n`, stack-pack icons and network request lists. Screenshots alone are most of a PSI response. All runs are kept by default (see section 9).
- **The partial unique index on `alerts`** makes "one open alert per problem" a database rule, which stops repeat emails.
- **Reports are snapshots,** so a shared link never reveals newer data than you chose to share.

---

## 5. Phases

### Phase 1: Core testing
- URL validation and normalization.
- `POST /api/analyze` runs one strategy, so results for each appear independently.
- Results page: score, field LCP/INP/CLS with their distributions and scope label, lab metrics, and opportunities ranked by `metricSavings.LCP`, then `overallSavingsMs`.
- When a page has no field data, the page says so instead of showing zeros.
- 5-minute Redis cache, sliding-window rate limit per IP (10 a minute to start), PSI timeout and backoff.
- Tests: URL validation, PSI parsing and opportunity ranking, using saved real responses.

### Phase 2: Accounts and history
- GitHub sign-in for everyone, magic link for the owner's address only (see section 9), with project and URL management.
- Signed-in tests are stored as `test_runs`.
- Trend charts per URL and metric for 7/30/90 days, overlaying mobile and desktop. A failed run shows as a gap rather than zero.

### Phase 3: Monitoring and alerts
- The dispatcher and worker from 1.1, with schedule settings per project.
- Regression detection (below), in-app feed for all users, email alerts for the owner's address, and per-project thresholds. A failed email never blocks the run or the in-app alert.

**How regression detection works.** All of this is pure functions in `domain/regression/`, tested heavily.

- **Baseline:** the **median** of the last N successful runs, default 10, for the same URL and strategy, excluding the current run. A median means one bad outlier can't distort it. Retests are excluded.
- **Too little history:** with under 5 runs, no alerts are raised and the UI says "building baseline".
- **Score drop:** `median - current > X`.
- **Retest before alerting:** Lighthouse scores swing between identical runs. A suspected score drop queues one retest 5 minutes later, and the alert fires only if both runs breach. This costs one extra PSI call only when something looks wrong, and it works the same on weekly schedules, where waiting for the next run would take a week.
- **Poor vitals:** fires when the baseline is not poor and the current value is, using LCP > 4000 ms, INP > 500 ms, CLS > 0.25.
- **Resolving:** an alert closes when the value recovers, so a flapping site doesn't resend email until it has recovered and then broken again.

**Limitation: field data moves slowly.** CrUX is a rolling 28-day window, so hourly tests won't catch a fresh field regression. Field data shows the trend that real users feel, and lab scores catch sudden breaks.

So the vital check uses field values when available. Otherwise it falls back to lab LCP and CLS, labelled as lab. INP has no lab equivalent, so it is **skipped** when field data is missing. It won't be estimated from another metric.

### Phase 4: AI fix suggestions
- **Stack detection** merges three signals, each with evidence: response headers, HTML markers (such as `__NEXT_DATA__`, `wp-content`, `cdn.shopify.com`) and Lighthouse `stackPacks`.
- **Generation is on demand** through a button rather than on every scheduled run, so monitoring doesn't use up the free AI quota.
- **The LLM gets only** failing audit IDs, titles, savings and a few trimmed items, plus the stack names and strategy. It never gets raw HTML, headers, cookies or the full JSON.
- **The output** is validated against a schema: priority, title, why, stack-specific steps, code example, estimated impact and difficulty. Impact is labelled as an estimate.
- **Controls:** cached per run and prompt version, a daily cap per user, and a clear "free AI quota used up, try later" message when Gemini returns a rate-limit error. I'll check SDK details and structured-output support against current docs when I build this.
- **Free-tier privacy:** Google's pricing page says free-tier content is used to improve its products. That fits this feature because it sends only public audit data about public sites. Nothing about the user is sent, and the UI will state this.

### Phase 5: Comparison and reports
- Up to 3 competitor URLs per project, compared side by side. Competitors are tested **on demand** and never alert, which saves quota.
- Shareable links: 256-bit random token stored hashed, optional expiry, revocable, marked `noindex`.
- Branded PDF generated from the same snapshot.

### At the end of every phase
1. Build, lint, type-check and tests all pass.
2. README updated with setup, env vars and how to run.
3. Commit and push, then give you a manual test checklist and **stop**.

**Commits:** small commits per feature within a phase, each pushed to `sirine2907/vitalwatch` on `main`. The repo is public, so anything committed is visible immediately. `.env.local` is gitignored before the first code commit.

---

## 6. Environment variables

Each is documented in `.env.example`. `src/lib/env.ts` validates them at startup.

| Variable | Phase | Purpose |
|---|---|---|
| `PAGESPEED_API_KEY` | 1 | Google Cloud API key. Required: Google's keyless quota is currently 0 |
| `PAGESPEED_API_URL` | 1 | Optional; points at a mock PSI server for local testing |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 1 | Cache and rate limit |
| `DATABASE_URL` | 2 | Neon or Supabase pooled URL |
| `AUTH_SECRET`, `AUTH_URL` | 2 | Auth.js |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | 2 | GitHub OAuth |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_OWNER_ADDRESS` | 2 | Magic links and alerts; without a domain, email goes only to the owner address |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | 3 | Scheduling |
| `APP_URL` | 3 | Public URL that QStash calls |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_LIMIT_PER_USER` | 4 | AI suggestions |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | 4 | Optional; if set, Claude is used instead of Gemini |

---

## 7. Security

- **SSRF, the main risk.** PSI fetches URLs from Google's servers, but stack detection fetches user-supplied URLs from **ours**. `site-fetcher.ts` resolves DNS and blocks private, loopback and cloud-metadata addresses. It re-checks every redirect and caps time and response size. HTML is parsed as text and never executed.
- **Prompt injection.** Website content is hostile input. Page HTML never reaches the LLM, and audit text is passed as data. AI output is rendered as plain text and code blocks, never as HTML.
- **Job endpoints** reject any request without a valid QStash signature.
- **Shared links** expose only the snapshot, with no project or user IDs.
- **Secrets:** the PSI key travels in a query string, so PSI URLs are never logged.

---

## 8. Testing

| Area | Coverage |
|---|---|
| URL validation | Missing scheme, IPv4/IPv6 private ranges, credentials, ports, punycode, length limit, normalization |
| PSI parsing | Real fixtures: full data, origin fallback, no field data, `runtimeError` |
| Regression | Too little history, outliers, exact-threshold edges, retest pass/fail, flapping, resolving |
| Stack detection | Header, HTML and stack-pack cases per platform, merged signals, false-positive guards |
| Schedule | Next-run calculation across month ends and missed slots |
| Repositories | Ownership isolation, duplicate-run protection, one-open-alert rule (PGlite) |
| Job endpoints | Rejected signature, redelivered message |

**Not tested automatically:** real emails, GitHub sign-in and live QStash delivery. These go on your manual checklists. Since QStash can't reach `localhost`, I'll include a dev-only way to trigger the dispatcher locally.

---

## 9. Free-tier constraints

This is a non-commercial portfolio project with no budget, which also fits Vercel Hobby's non-commercial rule.

| Constraint | What the app does |
|---|---|
| **Email:** Resend's test sender only reaches your own account address, and a verified domain costs money | GitHub sign-in is the main login. Magic link and alert emails work for your address, which is enough to demo them. Other users get in-app alerts, and the UI explains why. If you ever get a domain, setting `EMAIL_FROM` and removing `EMAIL_OWNER_ADDRESS` opens email to everyone, with no code changes. |
| **AI:** Gemini's free limits aren't published on its docs pages and are shown only in AI Studio | Default cap of 10 generations per user per day, results cached per run, generated only on click. I'll adjust the cap once your AI Studio limits are visible. |
| **Scheduling:** QStash's free limit is 1,000 messages a day | About 18 hourly URLs in total. The app caps each user's monitored URLs to protect the shared quota. |

**Remaining defaults**
- **PDF branding:** VitalWatch branding plus the project's own name, with an optional logo and accent color per project.
- **Raw JSON:** keep everything and measure the real per-run size in Phase 2. If it threatens the free database limit, I'd prune only `raw` and keep the metrics forever, after asking you.

### Accounts you'll need

| Phase | Service | Cost |
|---|---|---|
| 1 | Google Cloud (PageSpeed Insights API key) | Free |
| 1 | Upstash Redis | Free tier |
| 2 | Neon or Supabase | Free tier |
| 2 | GitHub OAuth app | Free |
| 2 | Resend | Free: 3,000 emails a month, 100 a day |
| 3 | QStash | Free tier, limits in 1.1 |
| 3 | A deployed public URL on Vercel | Free (Hobby) |
| 4 | Google AI Studio (Gemini API key) | Free tier |

**Phase 1 can't be fully tested without the Google and Upstash keys.** I won't add an in-memory fallback, since you ruled that out. If the Upstash variables are missing in development, the app will skip caching and rate limiting and log a clear warning. In production it refuses to start.
