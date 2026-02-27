# AI Layoff Radar

AI Layoff Radar is a public, no-login website that tracks AI-related workforce impact in near real time.

It combines:
- App-driven freshness checks every 5 minutes (configurable) for public news RSS feeds
- AI model-based classification for each new report (only AI-related layoff candidates are ingested)
- Estimated people-fired extraction from report text (plus severity-based imputation when headcount is undisclosed)
- Crowdsourced submissions from workers and observers
- Manual moderation queue for all public form submissions
- Aggregated dashboard analytics (monthly trend, industry risk, role vulnerability, geography, velocity)
- A company response channel for neutral context

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- SQLite (`better-sqlite3`)
- Recharts (data visualization)
- Zod (API validation)
- `rss-parser` (news ingestion)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

User visits read from a local JSON cache file at `./data/layoff-reports.json`.  
When cache is stale, the app can trigger ingestion automatically.

## Ingestion Modes

Run ingestion once:

```bash
npm run ingest
```

Run a persistent hourly worker:

```bash
npm run worker
```

## Current Source Coverage

The ingestion pipeline currently pulls from:

- Google News RSS search editions (`US`, `UK`, `India`, `Canada`, `Australia`) across AI + layoffs/job-cuts queries
- BBC (`Business`, `Technology`)
- The Guardian (`Business`, `Technology`)
- New York Times (`Business`, `Technology`)
- WSJ (`WSJD`)
- CNBC (`Top News`, `Technology`)
- TechCrunch AI
- VentureBeat AI
- Wired AI
- Hacker News AI-layoff search feed (community signal layer)

Public source catalog endpoint:

```bash
GET /api/sources
```

Important: no public pipeline can guarantee 100% worldwide layoff coverage (some publishers have no RSS or paywalled APIs), but this setup broadens coverage significantly while keeping quality controls.

## Environment Variables

Create `.env.local` (optional):

```bash
DATABASE_PATH=/absolute/path/to/ai-layoff-radar.sqlite
CRON_SECRET=replace-with-random-secret
DASHBOARD_CACHE_PATH=/absolute/path/to/layoff-reports.json
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
APP_INGEST_REFRESH_MINUTES=5
MODERATION_ADMIN_TOKEN=replace-with-long-random-token
SIGNAL_SUBMISSION_LIMIT_PER_HOUR=6
COMPANY_RESPONSE_LIMIT_PER_HOUR=4
```

If `DATABASE_PATH` is not set, the default is `./data/ai-layoff-radar.sqlite`.
In serverless runtimes (for example Vercel), it automatically falls back to `/tmp/layofftracker/ai-layoff-radar.sqlite`.

`CRON_SECRET` protects the cron endpoint (`/api/cron/ingest`).

If `OPENAI_API_KEY` is not set, ingestion still works using the local heuristic fallback model.
`APP_INGEST_REFRESH_MINUTES` controls how often app requests can trigger ingestion (default: 5).
If `MODERATION_ADMIN_TOKEN` is set, only requests with that token can review/approve/reject queued submissions.

`DASHBOARD_CACHE_PATH` defaults to `./data/layoff-reports.json`.
In serverless runtimes, cache falls back to `/tmp/layofftracker/layoff-reports.json`.

## Deploy + Daily Fetch

This repo includes `vercel.json` with a daily midnight cron schedule:

- `0 0 * * *` -> `/api/cron/ingest`

For production, set `CRON_SECRET` so only authorized cron calls can trigger ingestion.

The app also runs ingestion checks on normal dashboard/page requests, so it no longer depends on cron frequency alone.
Each successful ingestion run refreshes the local JSON cache file, and dashboard reads use that cache.

## Moderation Queue (Owner Approval)

- `POST /api/submit` and `POST /api/company-response` now queue entries as `pending`.
- Pending items do **not** affect public numbers until approved.
- Dashboard analytics only use `moderation_status = approved`.

Moderation API (requires `MODERATION_ADMIN_TOKEN`):

```bash
# List pending impact events + company responses
curl "https://your-domain/api/admin/moderation?target=all&status=pending&limit=50" \
  -H "x-admin-token: $MODERATION_ADMIN_TOKEN"

# Approve impact event id=123
curl -X POST "https://your-domain/api/admin/moderation" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $MODERATION_ADMIN_TOKEN" \
  -d '{"target":"impact_event","id":123,"action":"approve","note":"verified source"}'

# Reject company response id=45
curl -X POST "https://your-domain/api/admin/moderation" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $MODERATION_ADMIN_TOKEN" \
  -d '{"target":"company_response","id":45,"action":"reject","note":"spam"}'
```

## Legal / Safety Positioning

- Data is displayed as aggregated signals and trends
- Entries are self-reported and/or sourced from public reporting
- The dashboard does not make legal accusations
- Companies can submit responses via the public company response form
