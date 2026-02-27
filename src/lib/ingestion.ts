import { createHash } from "node:crypto";

import Parser from "rss-parser";

import { analyzeLayoffReport } from "@/lib/ai-analysis";
import { refreshDashboardCache } from "@/lib/dashboard-cache";
import {
  createIngestionRun,
  finishIngestionRun,
  getLastSuccessfulIngestionAt,
  hasEventByExternalId,
  hasEventBySourceUrl,
  insertEvent,
} from "@/lib/db";

interface FeedDescriptor {
  name: string;
  url: string;
  maxItems?: number;
  channel: "news" | "publication" | "community";
}

interface GoogleNewsEdition {
  label: string;
  hl: string;
  gl: string;
  ceid: string;
}

interface GoogleNewsSearch {
  label: string;
  query: string;
}

interface FeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
}

export interface IngestionResult {
  startedAt: string;
  completedAt: string;
  fetchedCount: number;
  insertedCount: number;
  skippedCount: number;
  trigger: string;
  errors: string[];
}

const GOOGLE_NEWS_EDITIONS: GoogleNewsEdition[] = [
  { label: "US", hl: "en-US", gl: "US", ceid: "US:en" },
  { label: "UK", hl: "en-GB", gl: "GB", ceid: "GB:en" },
  { label: "India", hl: "en-IN", gl: "IN", ceid: "IN:en" },
  { label: "Canada", hl: "en-CA", gl: "CA", ceid: "CA:en" },
  { label: "Australia", hl: "en-AU", gl: "AU", ceid: "AU:en" },
];

const GOOGLE_NEWS_SEARCHES: GoogleNewsSearch[] = [
  {
    label: "AI Layoffs",
    query:
      "(\"AI\" OR \"artificial intelligence\" OR automation OR \"generative AI\") (layoffs OR \"job cuts\" OR redundancies OR \"workforce reduction\" OR \"headcount reduction\")",
  },
  {
    label: "AI Job Displacement",
    query:
      "(\"AI\" OR \"machine learning\" OR chatbot OR \"LLM\") (displaced workers OR layoffs OR \"cut jobs\" OR redundancies)",
  },
  {
    label: "Automation Workforce Cuts",
    query:
      "(automation OR \"generative AI\" OR \"AI assistant\") (\"workforce cuts\" OR layoffs OR \"job losses\")",
  },
  {
    label: "Role Replacement",
    query:
      "(\"AI tools\" OR \"AI agents\" OR \"AI automation\") (\"replacing workers\" OR layoffs OR \"staff cuts\")",
  },
];

const NEWS_FEEDS: FeedDescriptor[] = GOOGLE_NEWS_EDITIONS.flatMap((edition) =>
  GOOGLE_NEWS_SEARCHES.map((search) => ({
    name: `Google News ${edition.label} - ${search.label}`,
    url: buildGoogleNewsSearchUrl(search.query, edition),
    channel: "news" as const,
    maxItems: 30,
  })),
);

const PUBLICATION_FEEDS: FeedDescriptor[] = [
  {
    name: "BBC Business",
    url: "http://feeds.bbci.co.uk/news/business/rss.xml",
    channel: "publication",
    maxItems: 35,
  },
  {
    name: "BBC Technology",
    url: "http://feeds.bbci.co.uk/news/technology/rss.xml",
    channel: "publication",
    maxItems: 35,
  },
  {
    name: "The Guardian Business",
    url: "https://www.theguardian.com/business/rss",
    channel: "publication",
    maxItems: 30,
  },
  {
    name: "The Guardian Technology",
    url: "https://www.theguardian.com/technology/rss",
    channel: "publication",
    maxItems: 30,
  },
  {
    name: "NYTimes Business",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    channel: "publication",
    maxItems: 30,
  },
  {
    name: "NYTimes Technology",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    channel: "publication",
    maxItems: 30,
  },
  {
    name: "WSJ Technology (WSJD)",
    url: "https://feeds.a.dj.com/rss/RSSWSJD.xml",
    channel: "publication",
    maxItems: 25,
  },
  {
    name: "CNBC Top News",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    channel: "publication",
    maxItems: 25,
  },
  {
    name: "CNBC Technology",
    url: "https://www.cnbc.com/id/19854910/device/rss/rss.html",
    channel: "publication",
    maxItems: 25,
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    channel: "publication",
    maxItems: 30,
  },
  {
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    channel: "publication",
    maxItems: 30,
  },
  {
    name: "Wired AI Tag",
    url: "https://www.wired.com/feed/tag/ai/latest/rss",
    channel: "publication",
    maxItems: 30,
  },
];

const COMMUNITY_FEEDS: FeedDescriptor[] = [
  {
    name: "HN RSS Search - AI Layoff",
    url: "https://hnrss.org/newest?q=ai+layoff",
    channel: "community",
    maxItems: 20,
  },
];

const FEED_SOURCES: FeedDescriptor[] = [
  ...NEWS_FEEDS,
  ...PUBLICATION_FEEDS,
  ...COMMUNITY_FEEDS,
];

const parser = new Parser<Record<string, never>, FeedItem>({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; AI-Layoff-Radar/1.0; +https://ailayoffradar.local)",
  },
});
let activeIngestion: Promise<IngestionResult> | null = null;

export function getIngestionSourceCatalog(): FeedDescriptor[] {
  return FEED_SOURCES.map((source) => ({ ...source }));
}

export async function ensureFreshIngestion(maxAgeMinutes = 60): Promise<void> {
  const lastSuccessful = getLastSuccessfulIngestionAt();

  if (lastSuccessful) {
    const lastTimestamp = Date.parse(lastSuccessful);
    if (!Number.isNaN(lastTimestamp)) {
      const ageMinutes = (Date.now() - lastTimestamp) / (1000 * 60);
      if (ageMinutes < maxAgeMinutes) {
        return;
      }
    }
  }

  await runIngestion("auto-refresh");
}

export async function runIngestion(trigger = "manual"): Promise<IngestionResult> {
  if (activeIngestion) {
    return activeIngestion;
  }

  activeIngestion = executeIngestion(trigger).finally(() => {
    activeIngestion = null;
  });

  return activeIngestion;
}

async function executeIngestion(trigger: string): Promise<IngestionResult> {
  const startedAt = new Date().toISOString();
  const runId = createIngestionRun(startedAt);
  let fetchedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const seenRunKeys = new Set<string>();

  try {
    const feedResults = await Promise.allSettled(
      FEED_SOURCES.map(async (source) => {
        const parsed = await parser.parseURL(source.url);
        const items = parsed.items ?? [];
        return { source, items };
      }),
    );

    for (const result of feedResults) {
      if (result.status === "rejected") {
        errors.push(`Feed error: ${String(result.reason)}`);
        continue;
      }

      const { source, items } = result.value;
      for (const item of items.slice(0, source.maxItems ?? 40)) {
        const title = cleanText(item.title);
        const summary = cleanText(item.contentSnippet ?? item.content);

        if (!title) {
          skippedCount += 1;
          continue;
        }

        fetchedCount += 1;
        const link = item.link?.trim() || null;
        const runKey = makeRunDedupKey(link, item.pubDate ?? item.isoDate ?? "", title);
        if (seenRunKeys.has(runKey)) {
          skippedCount += 1;
          continue;
        }
        seenRunKeys.add(runKey);

        const externalId = makeExternalId(
          source.name,
          link,
          item.pubDate ?? item.isoDate ?? "",
          title,
        );

        if (hasEventByExternalId(externalId)) {
          skippedCount += 1;
          continue;
        }

        if (link && hasEventBySourceUrl(link)) {
          skippedCount += 1;
          continue;
        }

        const analysis = await analyzeLayoffReport({
          title,
          summary,
          sourceName: source.name,
          sourceUrl: link,
        });

        if (!analysis.isLayoffCandidate || !analysis.isAiRelated) {
          skippedCount += 1;
          continue;
        }

        const normalizedConfidence = adjustConfidence(
          analysis.confidence,
          source.channel,
        );

        const inserted = insertEvent({
          externalId,
          sourceType: "news",
          sourceName: `${source.name} (${source.channel})`,
          sourceUrl: link,
          title: truncate(title, 240),
          summary: truncate(summary || title, 1500),
          company: analysis.company,
          industry: analysis.industry,
          jobFunction: analysis.jobFunction,
          country: analysis.country,
          impactType: analysis.impactType,
          severityScore: analysis.severityScore,
          confidence: normalizedConfidence,
          isAiRelated: analysis.isAiRelated,
          aiReason: analysis.rationale,
          aiModel: analysis.model,
          aiConfidence: normalizedConfidence,
          aiAnalyzedAt: new Date().toISOString(),
          peopleFiredEstimate: analysis.peopleFiredEstimate,
          peopleFiredConfidence: analysis.peopleFiredConfidence,
          reportedAt: normalizeDate(item.pubDate ?? item.isoDate),
        });

        if (inserted) {
          insertedCount += 1;
        } else {
          skippedCount += 1;
        }
      }
    }

    const completedAt = new Date().toISOString();
    finishIngestionRun({
      id: runId,
      completedAt,
      status: "success",
      fetchedCount,
      insertedCount,
      errorMessage: errors.length > 0 ? errors.join(" | ") : undefined,
    });

    try {
      refreshDashboardCache();
    } catch (cacheError) {
      const message =
        cacheError instanceof Error ? cacheError.message : String(cacheError);
      errors.push(`Cache refresh error: ${message}`);
    }

    return {
      startedAt,
      completedAt,
      fetchedCount,
      insertedCount,
      skippedCount,
      trigger,
      errors,
    };
  } catch (error) {
    try {
      refreshDashboardCache();
    } catch {
      // Best effort cache refresh when ingestion fails.
    }

    const completedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);

    finishIngestionRun({
      id: runId,
      completedAt,
      status: "failed",
      fetchedCount,
      insertedCount,
      errorMessage,
    });

    return {
      startedAt,
      completedAt,
      fetchedCount,
      insertedCount,
      skippedCount,
      trigger,
      errors: [errorMessage],
    };
  }
}

function buildGoogleNewsSearchUrl(
  query: string,
  edition: GoogleNewsEdition,
): string {
  const params = new URLSearchParams({
    q: query,
    hl: edition.hl,
    gl: edition.gl,
    ceid: edition.ceid,
  });

  return `https://news.google.com/rss/search?${params.toString()}`;
}

function makeExternalId(
  sourceName: string,
  link: string | null,
  publishedAt: string,
  title: string,
): string {
  return createHash("sha256")
    .update(`${sourceName}|${link ?? ""}|${publishedAt}|${title}`)
    .digest("hex");
}

function makeRunDedupKey(
  link: string | null,
  publishedAt: string,
  title: string,
): string {
  return createHash("sha256")
    .update(`${link ?? ""}|${publishedAt}|${title}`)
    .digest("hex");
}

function cleanText(value?: string): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normalizeDate(rawDate?: string): string {
  if (!rawDate) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(rawDate);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function adjustConfidence(
  confidence: number,
  channel: "news" | "publication" | "community",
): number {
  const delta =
    channel === "news" ? 0.08 : channel === "publication" ? 0.04 : -0.08;
  const adjusted = confidence + delta;
  return Number(Math.min(0.95, Math.max(0.35, adjusted)).toFixed(2));
}
