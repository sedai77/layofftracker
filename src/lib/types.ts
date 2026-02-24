import type { ImpactType } from "@/lib/options";

export type SourceType = "news" | "crowd";

export interface ImpactEvent {
  id: number;
  externalId: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  summary: string;
  company: string | null;
  industry: string;
  jobFunction: string;
  country: string;
  impactType: ImpactType;
  severityScore: number;
  confidence: number;
  isAiRelated: boolean;
  aiReason: string | null;
  aiModel: string | null;
  aiConfidence: number;
  aiAnalyzedAt: string;
  peopleFiredEstimate: number;
  peopleFiredConfidence: number;
  reportedAt: string;
  createdAt: string;
}

export interface MonthlyTrendPoint {
  month: string;
  layoffs: number;
  productivity: number;
  totalSignals: number;
}

export interface WeeklyVelocityPoint {
  week: string;
  score: number;
}

export interface RiskIndexPoint {
  label: string;
  score: number;
  signals: number;
}

export interface CountryHeatPoint {
  country: string;
  score: number;
  signals: number;
}

export interface StoryPoint {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string | null;
  impactType: ImpactType;
  industry: string;
  company: string | null;
  reportedAt: string;
  confidence: number;
}

export interface DashboardData {
  generatedAt: string;
  summary: {
    totalSignals: number;
    layoffSignals: number;
    layoffSignalsLast30Days: number;
    layoffSignalsLast7Days: number;
    layoffSignalsThisMonth: number;
    peopleFiredTotal: number;
    peopleFiredLast30Days: number;
    peopleFiredLast7Days: number;
    peopleFiredThisMonth: number;
    layoffReportsWithoutHeadcount: number;
    topLayoffIndustry: string | null;
    topLayoffIndustrySignals: number;
    topLayoffIndustryPeopleFired: number;
    averageRisk: number;
    industriesTracked: number;
    countriesTracked: number;
    currentVelocity: number;
    velocityDeltaPct: number;
  };
  monthlyTrend: MonthlyTrendPoint[];
  weeklyVelocity: WeeklyVelocityPoint[];
  industryRiskIndex: RiskIndexPoint[];
  roleVulnerability: RiskIndexPoint[];
  countryHeatmap: CountryHeatPoint[];
  stories: StoryPoint[];
  availableCountries: string[];
  availableIndustries: string[];
  lastIngestedAt: string | null;
}

export interface DashboardFilters {
  country?: string;
  industry?: string;
}
