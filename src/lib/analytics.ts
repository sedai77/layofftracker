import {
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

import { getDb, getLastSuccessfulIngestionAt } from "@/lib/db";
import type { ImpactType } from "@/lib/options";
import type {
  CountryHeatPoint,
  DashboardData,
  DashboardFilters,
  MonthlyTrendPoint,
  RiskIndexPoint,
  StoryPoint,
  WeeklyVelocityPoint,
} from "@/lib/types";

interface EventRow {
  id: number;
  title: string;
  summary: string;
  source_name: string;
  source_url: string | null;
  company: string | null;
  industry: string;
  job_function: string;
  country: string;
  impact_type: ImpactType;
  severity_score: number;
  confidence: number;
  people_fired_estimate: number;
  people_fired_confidence: number;
  reported_at: string;
  created_at: string;
}

const IMPACT_WEIGHT: Record<ImpactType, number> = {
  automation: 1,
  partial: 0.65,
  productivity: 0.25,
};

const LAYOFF_WEIGHT: Record<ImpactType, number> = {
  automation: 1,
  partial: 0.7,
  productivity: 0,
};

export function getDashboardData(filters: DashboardFilters = {}): DashboardData {
  const db = getDb();
  const sinceIso = subDays(new Date(), 240).toISOString();

  const conditions = [
    "is_ai_related = 1",
    "moderation_status = 'approved'",
    "datetime(reported_at) >= datetime(?)",
  ];
  const args: Array<string> = [sinceIso];

  if (filters.country && filters.country !== "All") {
    conditions.push("country = ?");
    args.push(filters.country);
  }

  if (filters.industry && filters.industry !== "All") {
    conditions.push("industry = ?");
    args.push(filters.industry);
  }

  const whereClause = conditions.join(" AND ");
  const rows = db
    .prepare(
      `
      SELECT
        id,
        title,
        summary,
        source_name,
        source_url,
        company,
        industry,
        job_function,
        country,
        impact_type,
        severity_score,
        confidence,
        people_fired_estimate,
        people_fired_confidence,
        reported_at,
        created_at
      FROM impact_events
      WHERE ${whereClause}
      ORDER BY datetime(reported_at) DESC
      `,
    )
    .all(...args) as EventRow[];

  const availableCountries = db
    .prepare(
      `
      SELECT DISTINCT country
      FROM impact_events
      WHERE is_ai_related = 1
        AND moderation_status = 'approved'
      ORDER BY country ASC
      `,
    )
    .all()
    .map((row) => String((row as { country: string }).country));

  const availableIndustries = db
    .prepare(
      `
      SELECT DISTINCT industry
      FROM impact_events
      WHERE is_ai_related = 1
        AND moderation_status = 'approved'
      ORDER BY industry ASC
      `,
    )
    .all()
    .map((row) => String((row as { industry: string }).industry));

  const monthlyTrend = buildMonthlyTrend(rows);
  const weeklyVelocity = buildWeeklyVelocity(rows);
  const industryRiskIndex = buildRiskIndex(rows, "industry");
  const roleVulnerability = buildRiskIndex(rows, "job_function");
  const countryHeatmap = buildCountryHeatmap(rows);

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);
  const monthStart = startOfMonth(now);

  const layoffRows = rows.filter((row) => row.impact_type !== "productivity");
  const layoffSignals = layoffRows.length;
  const layoffSignalsLast7Days = countEventsSince(layoffRows, sevenDaysAgo);
  const layoffSignalsLast30Days = countEventsSince(layoffRows, thirtyDaysAgo);
  const layoffSignalsThisMonth = countEventsSince(layoffRows, monthStart);
  const peopleFiredTotal = sumPeopleFired(layoffRows);
  const peopleFiredLast7Days = sumPeopleFiredSince(layoffRows, sevenDaysAgo);
  const peopleFiredLast30Days = sumPeopleFiredSince(layoffRows, thirtyDaysAgo);
  const peopleFiredThisMonth = sumPeopleFiredSince(layoffRows, monthStart);
  const layoffReportsWithoutHeadcount = layoffRows.filter(
    (row) => row.people_fired_estimate <= 0,
  ).length;
  const industriesTracked = new Set(rows.map((row) => row.industry)).size;
  const countriesTracked = new Set(rows.map((row) => row.country)).size;

  const topLayoffIndustry = findTopLayoffIndustry(layoffRows);
  const topLayoffIndustryPeopleFired = topLayoffIndustry
    ? sumPeopleFired(
        layoffRows.filter((row) => row.industry === topLayoffIndustry.label),
      )
    : 0;

  const currentVelocity =
    weeklyVelocity.slice(-2).reduce((sum, item) => sum + item.score, 0) / Math.max(1, 2);

  const previousVelocity =
    weeklyVelocity.slice(-4, -2).reduce((sum, item) => sum + item.score, 0) /
    Math.max(1, 2);

  const velocityDeltaPct =
    previousVelocity > 0
      ? Number((((currentVelocity - previousVelocity) / previousVelocity) * 100).toFixed(1))
      : currentVelocity > 0
        ? 100
        : 0;

  const averageRisk =
    industryRiskIndex.length > 0
      ? Math.round(
          industryRiskIndex.reduce((sum, item) => sum + item.score, 0) /
            industryRiskIndex.length,
        )
      : 0;

  const stories: StoryPoint[] = rows.slice(0, 12).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    impactType: row.impact_type,
    industry: row.industry,
    company: row.company,
    reportedAt: row.reported_at,
    confidence: row.confidence,
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSignals: rows.length,
      layoffSignals,
      layoffSignalsLast30Days,
      layoffSignalsLast7Days,
      layoffSignalsThisMonth,
      peopleFiredTotal,
      peopleFiredLast30Days,
      peopleFiredLast7Days,
      peopleFiredThisMonth,
      layoffReportsWithoutHeadcount,
      topLayoffIndustry: topLayoffIndustry?.label ?? null,
      topLayoffIndustrySignals: topLayoffIndustry?.signals ?? 0,
      topLayoffIndustryPeopleFired,
      averageRisk,
      industriesTracked,
      countriesTracked,
      currentVelocity: Number(currentVelocity.toFixed(2)),
      velocityDeltaPct,
    },
    monthlyTrend,
    weeklyVelocity,
    industryRiskIndex,
    roleVulnerability,
    countryHeatmap,
    stories,
    availableCountries,
    availableIndustries,
    lastIngestedAt: getLastSuccessfulIngestionAt(),
  };
}

function buildMonthlyTrend(rows: EventRow[]): MonthlyTrendPoint[] {
  const monthKeys: string[] = [];
  const buckets = new Map<string, MonthlyTrendPoint>();

  for (let index = 7; index >= 0; index -= 1) {
    const date = startOfMonth(subMonths(new Date(), index));
    const key = format(date, "yyyy-MM");
    monthKeys.push(key);
    buckets.set(key, {
      month: format(date, "MMM yyyy"),
      layoffs: 0,
      productivity: 0,
      totalSignals: 0,
    });
  }

  rows.forEach((row) => {
    const parsed = new Date(row.reported_at);
    if (Number.isNaN(parsed.valueOf())) {
      return;
    }

    const key = format(startOfMonth(parsed), "yyyy-MM");
    const bucket = buckets.get(key);
    if (!bucket) {
      return;
    }

    bucket.totalSignals += 1;

    if (row.impact_type === "productivity") {
      bucket.productivity += 1;
    } else {
      bucket.layoffs += LAYOFF_WEIGHT[row.impact_type];
    }
  });

  return monthKeys.map((key) => {
    const bucket = buckets.get(key);
    if (!bucket) {
      return {
        month: key,
        layoffs: 0,
        productivity: 0,
        totalSignals: 0,
      };
    }

    return {
      ...bucket,
      layoffs: Number(bucket.layoffs.toFixed(2)),
      productivity: Number(bucket.productivity.toFixed(2)),
    };
  });
}

function buildWeeklyVelocity(rows: EventRow[]): WeeklyVelocityPoint[] {
  const weekKeys: string[] = [];
  const buckets = new Map<string, WeeklyVelocityPoint>();

  for (let index = 11; index >= 0; index -= 1) {
    const weekStart = startOfWeek(subWeeks(new Date(), index), {
      weekStartsOn: 1,
    });
    const key = format(weekStart, "yyyy-MM-dd");

    weekKeys.push(key);
    buckets.set(key, {
      week: format(weekStart, "MMM d"),
      score: 0,
    });
  }

  rows.forEach((row) => {
    const parsed = new Date(row.reported_at);
    if (Number.isNaN(parsed.valueOf())) {
      return;
    }

    const key = format(
      startOfWeek(parsed, {
        weekStartsOn: 1,
      }),
      "yyyy-MM-dd",
    );

    const bucket = buckets.get(key);
    if (!bucket) {
      return;
    }

    const weight = IMPACT_WEIGHT[row.impact_type];
    const severityFactor = row.severity_score / 100;
    bucket.score += weight * severityFactor;
  });

  return weekKeys.map((key) => {
    const bucket = buckets.get(key);
    if (!bucket) {
      return { week: key, score: 0 };
    }

    return {
      week: bucket.week,
      score: Number(bucket.score.toFixed(2)),
    };
  });
}

function buildRiskIndex(
  rows: EventRow[],
  dimension: "industry" | "job_function",
): RiskIndexPoint[] {
  const buckets = new Map<
    string,
    {
      signals: number;
      weightedImpact: number;
      severityTotal: number;
    }
  >();

  rows.forEach((row) => {
    const label = dimension === "industry" ? row.industry : row.job_function;

    const bucket =
      buckets.get(label) ??
      {
        signals: 0,
        weightedImpact: 0,
        severityTotal: 0,
      };

    bucket.signals += 1;
    bucket.weightedImpact += IMPACT_WEIGHT[row.impact_type];
    bucket.severityTotal += row.severity_score;

    buckets.set(label, bucket);
  });

  const maxSignals = Math.max(
    1,
    ...Array.from(buckets.values()).map((bucket) => bucket.signals),
  );

  const list: RiskIndexPoint[] = Array.from(buckets.entries())
    .map(([label, bucket]) => {
      const impactScore = (bucket.weightedImpact / bucket.signals) * 65;
      const severityScore = (bucket.severityTotal / bucket.signals) * 0.22;
      const concentrationScore =
        (Math.log1p(bucket.signals) / Math.log1p(maxSignals)) * 13;
      const score = clamp(
        Math.round(impactScore + severityScore + concentrationScore),
        4,
        100,
      );

      return {
        label,
        score,
        signals: bucket.signals,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return list;
}

function buildCountryHeatmap(rows: EventRow[]): CountryHeatPoint[] {
  const buckets = new Map<
    string,
    {
      signals: number;
      weightedScore: number;
    }
  >();

  rows.forEach((row) => {
    const existing =
      buckets.get(row.country) ??
      {
        signals: 0,
        weightedScore: 0,
      };

    existing.signals += 1;
    existing.weightedScore +=
      IMPACT_WEIGHT[row.impact_type] * (row.severity_score / 100) * 100;

    buckets.set(row.country, existing);
  });

  return Array.from(buckets.entries())
    .map(([country, bucket]) => ({
      country,
      score: clamp(Math.round(bucket.weightedScore / bucket.signals), 1, 100),
      signals: bucket.signals,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countEventsSince(rows: EventRow[], sinceDate: Date): number {
  return rows.reduce((count, row) => {
    const parsed = new Date(row.reported_at);
    if (Number.isNaN(parsed.valueOf())) {
      return count;
    }

    return parsed >= sinceDate ? count + 1 : count;
  }, 0);
}

function findTopLayoffIndustry(
  layoffRows: EventRow[],
): { label: string; signals: number } | null {
  const counts = new Map<string, number>();

  layoffRows.forEach((row) => {
    counts.set(row.industry, (counts.get(row.industry) ?? 0) + 1);
  });

  let topLabel: string | null = null;
  let topCount = 0;

  counts.forEach((value, key) => {
    if (value > topCount) {
      topLabel = key;
      topCount = value;
    }
  });

  if (!topLabel) {
    return null;
  }

  return {
    label: topLabel,
    signals: topCount,
  };
}

function sumPeopleFired(rows: EventRow[]): number {
  return rows.reduce((total, row) => {
    return total + effectivePeopleFired(row);
  }, 0);
}

function sumPeopleFiredSince(rows: EventRow[], sinceDate: Date): number {
  return rows.reduce((total, row) => {
    const parsed = new Date(row.reported_at);
    if (Number.isNaN(parsed.valueOf())) {
      return total;
    }

    return parsed >= sinceDate ? total + effectivePeopleFired(row) : total;
  }, 0);
}

function effectivePeopleFired(row: EventRow): number {
  if (row.people_fired_estimate > 0) {
    return row.people_fired_estimate;
  }

  if (row.impact_type === "productivity") {
    return 0;
  }

  const severity = row.severity_score;
  let estimate = 30;

  if (severity >= 90) {
    estimate = 400;
  } else if (severity >= 80) {
    estimate = 250;
  } else if (severity >= 70) {
    estimate = 180;
  } else if (severity >= 60) {
    estimate = 120;
  } else if (severity >= 50) {
    estimate = 80;
  } else if (severity >= 40) {
    estimate = 50;
  }

  if (row.impact_type === "partial") {
    estimate = Math.round(estimate * 0.6);
  }

  return estimate;
}
