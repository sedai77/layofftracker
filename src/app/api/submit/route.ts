import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { analyzeLayoffReport } from "@/lib/ai-analysis";
import { consumeSubmissionRateLimit, insertEvent } from "@/lib/db";
import { getRequesterIp } from "@/lib/request-security";
import { submissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = submissionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid submission",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const requesterIp = getRequesterIp(request);
    const limit = consumeSubmissionRateLimit({
      channel: "submit_signal",
      requesterIp,
      maxPerHour: Number(process.env.SIGNAL_SUBMISSION_LIMIT_PER_HOUR ?? 6),
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many submissions from this source. Try again later.",
        },
        {
          status: 429,
        },
      );
    }

    if (!data.sourceUrl && !data.company) {
      return NextResponse.json(
        {
          error: "Submission requires context",
          message: "Provide at least a source URL or company name.",
        },
        {
          status: 400,
        },
      );
    }

    const now = new Date().toISOString();
    const aiAnalysis = await analyzeLayoffReport({
      title: data.title,
      summary: data.summary,
      sourceName: "Self-reported submission",
      sourceUrl: data.sourceUrl ?? null,
    });

    const reportedAt = normalizeReportedDate(data.reportedAt, now);
    const externalId = buildSubmissionExternalId(data, reportedAt);

    const inserted = insertEvent({
      externalId,
      sourceType: "crowd",
      moderationStatus: "pending",
      sourceName: "Self-reported submission",
      sourceUrl: data.sourceUrl ?? null,
      title: data.title,
      summary: data.summary,
      company: data.company ?? null,
      industry: data.industry,
      jobFunction: data.jobFunction,
      country: data.country,
      impactType: data.impactType,
      severityScore: inferSeverity(data.impactType),
      confidence: data.sourceUrl ? 0.64 : 0.56,
      isAiRelated: aiAnalysis.isAiRelated,
      aiReason: aiAnalysis.rationale,
      aiModel: aiAnalysis.model,
      aiConfidence: aiAnalysis.confidence,
      aiAnalyzedAt: now,
      peopleFiredEstimate: aiAnalysis.peopleFiredEstimate,
      peopleFiredConfidence: aiAnalysis.peopleFiredConfidence,
      reportedAt,
    });

    if (!inserted) {
      return NextResponse.json(
        {
          error: "Duplicate submission",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "Submission received and queued for moderator approval before it appears in public numbers.",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Submission failed",
        message,
      },
      {
        status: 500,
      },
    );
  }
}

function buildSubmissionExternalId(
  data: {
    title: string;
    summary: string;
    company?: string;
    industry: string;
    jobFunction: string;
    country: string;
    impactType: "automation" | "partial" | "productivity";
    sourceUrl?: string;
  },
  reportedAt: string,
): string {
  const normalizedReportedDay = reportedAt.slice(0, 10);

  return createHash("sha256")
    .update(
      [
        "crowd",
        normalizeForFingerprint(data.title),
        normalizeForFingerprint(data.summary),
        normalizeForFingerprint(data.company ?? ""),
        data.industry,
        data.jobFunction,
        data.country,
        data.impactType,
        normalizeForFingerprint(data.sourceUrl ?? ""),
        normalizedReportedDay,
      ].join("|"),
    )
    .digest("hex");
}

function normalizeForFingerprint(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 500);
}

function normalizeReportedDate(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function inferSeverity(impactType: "automation" | "partial" | "productivity"): number {
  if (impactType === "automation") {
    return 80;
  }

  if (impactType === "partial") {
    return 62;
  }

  return 38;
}
