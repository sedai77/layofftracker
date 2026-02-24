import fs from "node:fs";
import path from "node:path";

import { getDashboardData } from "@/lib/analytics";
import { getDb, getLastSuccessfulIngestionAt } from "@/lib/db";
import { resolveWritableFilePath } from "@/lib/storage-path";
import type { DashboardData, DashboardFilters, ImpactEvent } from "@/lib/types";

const cachePath = resolveWritableFilePath({
  envPath: process.env.DASHBOARD_CACHE_PATH,
  defaultFileName: "layoff-reports.json",
});

interface DashboardCacheFile {
  version: 2;
  generatedAt: string;
  lastIngestedAt: string | null;
  availableCountries: string[];
  availableIndustries: string[];
  dashboardByKey: Record<string, DashboardData>;
  events: ImpactEvent[];
}

interface DbEventRow {
  id: number;
  external_id: string;
  source_type: "news" | "crowd";
  source_name: string;
  source_url: string | null;
  title: string;
  summary: string;
  company: string | null;
  industry: string;
  job_function: string;
  country: string;
  impact_type: "automation" | "partial" | "productivity";
  severity_score: number;
  confidence: number;
  is_ai_related: number;
  ai_reason: string | null;
  ai_model: string | null;
  ai_confidence: number | null;
  ai_analyzed_at: string | null;
  people_fired_estimate: number | null;
  people_fired_confidence: number | null;
  reported_at: string;
  created_at: string;
}

export function getDashboardDataFromCache(
  filters: DashboardFilters = {},
): DashboardData {
  const cache = ensureDashboardCache();
  const key = toCacheKey(filters);
  const defaultEntry = cache.dashboardByKey[toCacheKey({})];

  if (!defaultEntry) {
    const refreshed = refreshDashboardCache();
    const refreshedDefault = refreshed.dashboardByKey[toCacheKey({})];
    if (!refreshedDefault) {
      throw new Error("Dashboard cache is empty after refresh.");
    }
    return refreshedDefault;
  }

  return cache.dashboardByKey[key] ?? defaultEntry;
}

export function ensureDashboardCache(): DashboardCacheFile {
  const cached = readDashboardCache();
  if (cached) {
    return cached;
  }

  return refreshDashboardCache();
}

export function refreshDashboardCache(): DashboardCacheFile {
  const defaultData = getDashboardData();
  const countries = defaultData.availableCountries;
  const industries = defaultData.availableIndustries;

  const dashboardByKey: Record<string, DashboardData> = {
    [toCacheKey({})]: defaultData,
  };

  for (const country of countries) {
    dashboardByKey[toCacheKey({ country })] = getDashboardData({ country });
  }

  for (const industry of industries) {
    dashboardByKey[toCacheKey({ industry })] = getDashboardData({ industry });
  }

  for (const country of countries) {
    for (const industry of industries) {
      dashboardByKey[toCacheKey({ country, industry })] = getDashboardData({
        country,
        industry,
      });
    }
  }

  const db = getDb();
  const events = db
    .prepare(
      `
      SELECT
        id,
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
        reported_at,
        created_at
      FROM impact_events
      ORDER BY datetime(reported_at) DESC
      LIMIT 5000
      `,
    )
    .all() as DbEventRow[];

  const payload: DashboardCacheFile = {
    version: 2,
    generatedAt: new Date().toISOString(),
    lastIngestedAt: getLastSuccessfulIngestionAt(),
    availableCountries: countries,
    availableIndustries: industries,
    dashboardByKey,
    events: events.map(mapDbEventToImpactEvent),
  };

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), "utf8");

  return payload;
}

export function getDashboardCachePath(): string {
  return cachePath;
}

function readDashboardCache(): DashboardCacheFile | null {
  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw) as DashboardCacheFile;

    const summary = parsed?.dashboardByKey?.[toCacheKey({})]?.summary;

    if (
      parsed?.version !== 2 ||
      !parsed.dashboardByKey ||
      typeof summary?.peopleFiredTotal !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function toCacheKey(filters: DashboardFilters): string {
  const country = filters.country && filters.country !== "All" ? filters.country : "All";
  const industry =
    filters.industry && filters.industry !== "All" ? filters.industry : "All";

  return `country=${encodeURIComponent(country)}|industry=${encodeURIComponent(industry)}`;
}

function mapDbEventToImpactEvent(row: DbEventRow): ImpactEvent {
  return {
    id: row.id,
    externalId: row.external_id,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    title: row.title,
    summary: row.summary,
    company: row.company,
    industry: row.industry,
    jobFunction: row.job_function,
    country: row.country,
    impactType: row.impact_type,
    severityScore: row.severity_score,
    confidence: row.confidence,
    isAiRelated: row.is_ai_related === 1,
    aiReason: row.ai_reason,
    aiModel: row.ai_model,
    aiConfidence: row.ai_confidence ?? row.confidence,
    aiAnalyzedAt: row.ai_analyzed_at ?? row.created_at,
    peopleFiredEstimate: row.people_fired_estimate ?? 0,
    peopleFiredConfidence: row.people_fired_confidence ?? 0,
    reportedAt: row.reported_at,
    createdAt: row.created_at,
  };
}
