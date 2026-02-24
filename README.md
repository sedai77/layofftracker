# AI Layoff Radar

AI Layoff Radar is a public, no-login website that tracks AI-related workforce impact in near real time.

It combines:
- Hourly ingestion of public news RSS feeds about AI displacement and productivity shifts
- AI model-based classification for each new layoff report (with heuristic fallback)
- Estimated people-fired extraction from report text (plus severity-based imputation when headcount is undisclosed)
- Crowdsourced submissions from workers and observers
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

User visits read from a local JSON cache file at `./data/layoff-reports.json`; visits do not trigger upstream searches.

## Ingestion Modes

Run ingestion once:

```bash
npm run ingest
```

Run a persistent hourly worker:

```bash
npm run worker
```

## Environment Variables

Create `.env.local` (optional):

```bash
DATABASE_PATH=/absolute/path/to/ai-layoff-radar.sqlite
CRON_SECRET=replace-with-random-secret
DASHBOARD_CACHE_PATH=/absolute/path/to/layoff-reports.json
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

If `DATABASE_PATH` is not set, the default is `./data/ai-layoff-radar.sqlite`.

`CRON_SECRET` protects the cron endpoint (`/api/cron/ingest`).

If `OPENAI_API_KEY` is not set, ingestion still works using the local heuristic fallback model.

`DASHBOARD_CACHE_PATH` defaults to `./data/layoff-reports.json`.

## Deploy + Hourly Fetch

This repo includes `vercel.json` with a daily midnight cron schedule:

- `0 0 * * *` -> `/api/cron/ingest`

For production, set `CRON_SECRET` so only authorized cron calls can trigger ingestion.

Each cron ingestion run refreshes the local JSON cache file. Dashboard/API reads use that cache file.

## Legal / Safety Positioning

- Data is displayed as aggregated signals and trends
- Entries are self-reported and/or sourced from public reporting
- The dashboard does not make legal accusations
- Companies can submit responses via the public company response form
