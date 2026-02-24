import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { estimateLayoffCount } from "@/lib/layoff-count";
import type { ImpactType } from "@/lib/options";
import { resolveWritableFilePath } from "@/lib/storage-path";
import type { SourceType } from "@/lib/types";

const databasePath = resolveWritableFilePath({
  envPath: process.env.DATABASE_PATH,
  defaultFileName: "ai-layoff-radar.sqlite",
});

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

type DbInstance = Database.Database;

type DbGlobal = typeof globalThis & {
  __layoffRadarDb?: DbInstance;
};

const globalForDb = globalThis as DbGlobal;

const db =
  globalForDb.__layoffRadarDb ??
  new Database(databasePath, {
    fileMustExist: false,
  });

if (!globalForDb.__layoffRadarDb) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS impact_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL CHECK (source_type IN ('news', 'crowd')),
      source_name TEXT NOT NULL,
      source_url TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      company TEXT,
      industry TEXT NOT NULL,
      job_function TEXT NOT NULL,
      country TEXT NOT NULL,
      impact_type TEXT NOT NULL CHECK (impact_type IN ('automation', 'partial', 'productivity')),
      severity_score INTEGER NOT NULL DEFAULT 50,
      confidence REAL NOT NULL DEFAULT 0.5,
      is_ai_related INTEGER NOT NULL DEFAULT 0,
      ai_reason TEXT,
      ai_model TEXT,
      ai_confidence REAL,
      ai_analyzed_at TEXT,
      people_fired_estimate INTEGER NOT NULL DEFAULT 0,
      people_fired_confidence REAL NOT NULL DEFAULT 0,
      reported_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_reported_at ON impact_events(reported_at);
    CREATE INDEX IF NOT EXISTS idx_events_industry ON impact_events(industry);
    CREATE INDEX IF NOT EXISTS idx_events_country ON impact_events(country);
    CREATE INDEX IF NOT EXISTS idx_events_impact_type ON impact_events(impact_type);

    CREATE TABLE IF NOT EXISTS company_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      statement TEXT NOT NULL,
      contact_email TEXT,
      reference_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
      fetched_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started ON ingestion_runs(started_at);
    CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON ingestion_runs(status);
  `);

  ensureColumn("impact_events", "is_ai_related", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("impact_events", "ai_reason", "TEXT");
  ensureColumn("impact_events", "ai_model", "TEXT");
  ensureColumn("impact_events", "ai_confidence", "REAL");
  ensureColumn("impact_events", "ai_analyzed_at", "TEXT");
  ensureColumn(
    "impact_events",
    "people_fired_estimate",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    "impact_events",
    "people_fired_confidence",
    "REAL NOT NULL DEFAULT 0",
  );

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_ai_related ON impact_events(is_ai_related);

    UPDATE impact_events
    SET is_ai_related = 1,
        ai_reason = COALESCE(ai_reason, 'Legacy record migrated before AI verdict layer.'),
        ai_model = COALESCE(ai_model, 'legacy-heuristic'),
        ai_confidence = COALESCE(ai_confidence, confidence),
        ai_analyzed_at = COALESCE(ai_analyzed_at, created_at),
        people_fired_estimate = COALESCE(people_fired_estimate, 0),
        people_fired_confidence = COALESCE(people_fired_confidence, 0)
    WHERE ai_model IS NULL;
  `);

  backfillPeopleFiredEstimates();

  globalForDb.__layoffRadarDb = db;
}

export interface EventInput {
  externalId: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string | null;
  title: string;
  summary: string;
  company?: string | null;
  industry: string;
  jobFunction: string;
  country: string;
  impactType: ImpactType;
  severityScore: number;
  confidence: number;
  isAiRelated: boolean;
  aiReason?: string | null;
  aiModel?: string | null;
  aiConfidence: number;
  aiAnalyzedAt: string;
  peopleFiredEstimate: number;
  peopleFiredConfidence: number;
  reportedAt: string;
}

export function insertEvent(input: EventInput): boolean {
  const statement = db.prepare(`
    INSERT OR IGNORE INTO impact_events (
      external_id,
      source_type,
      source_name,
      source_url,
      title,
      summary,
      company,
      industry,
      job_function,
      country,
      impact_type,
      severity_score,
      confidence,
      is_ai_related,
      ai_reason,
      ai_model,
      ai_confidence,
      ai_analyzed_at,
      people_fired_estimate,
      people_fired_confidence,
      reported_at
    ) VALUES (
      @externalId,
      @sourceType,
      @sourceName,
      @sourceUrl,
      @title,
      @summary,
      @company,
      @industry,
      @jobFunction,
      @country,
      @impactType,
      @severityScore,
      @confidence,
      @isAiRelated,
      @aiReason,
      @aiModel,
      @aiConfidence,
      @aiAnalyzedAt,
      @peopleFiredEstimate,
      @peopleFiredConfidence,
      @reportedAt
    )
  `);

  const result = statement.run({
    ...input,
    sourceUrl: input.sourceUrl ?? null,
    company: input.company ?? null,
    isAiRelated: input.isAiRelated ? 1 : 0,
    aiReason: input.aiReason ?? null,
    aiModel: input.aiModel ?? null,
    peopleFiredEstimate: Math.max(0, Math.round(input.peopleFiredEstimate)),
    peopleFiredConfidence: Number(
      Math.min(1, Math.max(0, input.peopleFiredConfidence)).toFixed(2),
    ),
  });

  return result.changes > 0;
}

export function hasEventByExternalId(externalId: string): boolean {
  const row = db
    .prepare(
      `
      SELECT 1
      FROM impact_events
      WHERE external_id = ?
      LIMIT 1
      `,
    )
    .get(externalId);

  return Boolean(row);
}

export function insertCompanyResponse(input: {
  company: string;
  statement: string;
  contactEmail?: string | null;
  referenceUrl?: string | null;
}): number {
  const statement = db.prepare(`
    INSERT INTO company_responses (
      company,
      statement,
      contact_email,
      reference_url
    ) VALUES (
      @company,
      @statement,
      @contactEmail,
      @referenceUrl
    )
  `);

  const result = statement.run({
    ...input,
    contactEmail: input.contactEmail ?? null,
    referenceUrl: input.referenceUrl ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function createIngestionRun(startedAt: string): number {
  const statement = db.prepare(`
    INSERT INTO ingestion_runs (started_at, status)
    VALUES (?, 'running')
  `);
  const result = statement.run(startedAt);
  return Number(result.lastInsertRowid);
}

export function finishIngestionRun(input: {
  id: number;
  completedAt: string;
  status: "success" | "failed";
  fetchedCount: number;
  insertedCount: number;
  errorMessage?: string;
}): void {
  db.prepare(`
    UPDATE ingestion_runs
    SET completed_at = @completedAt,
        status = @status,
        fetched_count = @fetchedCount,
        inserted_count = @insertedCount,
        error_message = @errorMessage
    WHERE id = @id
  `).run({
    ...input,
    errorMessage: input.errorMessage ?? null,
  });
}

export function getLastSuccessfulIngestionAt(): string | null {
  const row = db
    .prepare(
      `
      SELECT completed_at AS completedAt
      FROM ingestion_runs
      WHERE status = 'success'
      ORDER BY datetime(completed_at) DESC
      LIMIT 1
      `,
    )
    .get() as { completedAt: string | null } | undefined;

  return row?.completedAt ?? null;
}

export function getDb() {
  return db;
}

function ensureColumn(
  tableName: string,
  columnName: string,
  columnDefinition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

function backfillPeopleFiredEstimates(): void {
  const rows = db
    .prepare(
      `
      SELECT id, title, summary, impact_type
      FROM impact_events
      WHERE (people_fired_estimate IS NULL OR people_fired_estimate = 0)
        AND impact_type != 'productivity'
      `,
    )
    .all() as Array<{
    id: number;
    title: string;
    summary: string;
    impact_type: ImpactType;
  }>;

  const update = db.prepare(
    `
    UPDATE impact_events
    SET people_fired_estimate = ?,
        people_fired_confidence = ?
    WHERE id = ?
    `,
  );

  for (const row of rows) {
    const estimate = estimateLayoffCount(row.title, row.summary);
    if (estimate.count <= 0) {
      continue;
    }

    update.run(estimate.count, estimate.confidence, row.id);
  }
}
