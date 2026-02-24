import { z } from "zod";

import {
  COUNTRY_OPTIONS,
  IMPACT_TYPE_OPTIONS,
  INDUSTRY_OPTIONS,
  JOB_FUNCTION_OPTIONS,
  type ImpactType,
} from "@/lib/options";
import { estimateLayoffCount } from "@/lib/layoff-count";
import {
  classifySignal,
  isLayoffReportCandidate,
  isValidCountry,
  isValidIndustry,
  isValidJobFunction,
} from "@/lib/classifier";

const aiVerdictSchema = z.object({
  isAiRelated: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(300),
  impactType: z.enum(IMPACT_TYPE_OPTIONS),
  industry: z.enum(INDUSTRY_OPTIONS),
  jobFunction: z.enum(JOB_FUNCTION_OPTIONS),
  country: z.enum(COUNTRY_OPTIONS),
  severityScore: z.number().int().min(1).max(100),
  peopleFiredEstimate: z.number().int().min(0).max(1_000_000),
  peopleFiredConfidence: z.number().min(0).max(1),
});

export interface AiAnalysisInput {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl?: string | null;
}

export interface AiAnalysisResult {
  isLayoffCandidate: boolean;
  isAiRelated: boolean;
  confidence: number;
  rationale: string;
  impactType: ImpactType;
  industry: string;
  jobFunction: string;
  country: string;
  severityScore: number;
  company: string | null;
  peopleFiredEstimate: number;
  peopleFiredConfidence: number;
  model: string;
}

const FALLBACK_MODEL = "heuristic-v1";

export async function analyzeLayoffReport(
  input: AiAnalysisInput,
): Promise<AiAnalysisResult> {
  const heuristic = classifySignal(input.title, input.summary);
  const layoffCandidate = isLayoffReportCandidate(input.title, input.summary);
  const fallback = buildFallbackResult(input, layoffCandidate, heuristic);

  if (!layoffCandidate) {
    return {
      ...fallback,
      rationale: "Not a layoff-focused report.",
      isAiRelated: false,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content:
              "You are a strict classifier for workforce reports. Decide if a report describes layoffs materially attributed to AI or automation. Return JSON only.",
          },
          {
            role: "user",
            content: [
              "Classify this layoff report.",
              "Definition for isAiRelated=true: layoffs or workforce reductions are explicitly attributed to AI automation, AI tooling, or generative AI adoption.",
              "Set isAiRelated=false when layoffs are unrelated, ambiguous, or just mention AI as context.",
              `Title: ${input.title}`,
              `Summary: ${input.summary}`,
              `Source: ${input.sourceName}`,
              input.sourceUrl ? `URL: ${input.sourceUrl}` : "URL: (none)",
              "Allowed enums:",
              `impactType: ${IMPACT_TYPE_OPTIONS.join(" | ")}`,
              `industry: ${INDUSTRY_OPTIONS.join(" | ")}`,
              `jobFunction: ${JOB_FUNCTION_OPTIONS.join(" | ")}`,
              `country: ${COUNTRY_OPTIONS.join(" | ")}`,
              "Return JSON with keys: isAiRelated, confidence (0-1), rationale, impactType, industry, jobFunction, country, severityScore (1-100), peopleFiredEstimate (int >=0), peopleFiredConfidence (0-1).",
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) {
      return fallback;
    }

    const parsedJson = safeJsonParse(raw);
    const validated = aiVerdictSchema.safeParse(parsedJson);
    if (!validated.success) {
      return fallback;
    }

    const verdict = validated.data;

    return {
      isLayoffCandidate: true,
      isAiRelated: verdict.isAiRelated,
      confidence: Number(verdict.confidence.toFixed(2)),
      rationale: truncate(verdict.rationale, 280),
      impactType: verdict.impactType,
      industry: verdict.industry,
      jobFunction: verdict.jobFunction,
      country: verdict.country,
      severityScore: verdict.severityScore,
      company: heuristic.company,
      peopleFiredEstimate: verdict.peopleFiredEstimate,
      peopleFiredConfidence: Number(verdict.peopleFiredConfidence.toFixed(2)),
      model,
    };
  } catch {
    return fallback;
  }
}

function buildFallbackResult(
  input: AiAnalysisInput,
  layoffCandidate: boolean,
  heuristic: ReturnType<typeof classifySignal>,
): AiAnalysisResult {
  const isAiRelated = layoffCandidate && heuristic.isRelevant;
  const countResult = estimateLayoffCount(input.title, input.summary);

  return {
    isLayoffCandidate: layoffCandidate,
    isAiRelated,
    confidence: heuristic.confidence,
    rationale: isAiRelated
      ? "Heuristic fallback: AI terms + layoff impact terms matched."
      : "Heuristic fallback: no strong AI-attributed layoff signal.",
    impactType: heuristic.impactType,
    industry: isValidIndustry(heuristic.industry)
      ? heuristic.industry
      : "Technology / SaaS",
    jobFunction: isValidJobFunction(heuristic.jobFunction)
      ? heuristic.jobFunction
      : "Operations",
    country: isValidCountry(heuristic.country)
      ? heuristic.country
      : "United States",
    severityScore: heuristic.severityScore,
    company: heuristic.company,
    peopleFiredEstimate: countResult.count,
    peopleFiredConfidence: countResult.confidence,
    model: FALLBACK_MODEL,
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
