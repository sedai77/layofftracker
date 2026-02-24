import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { analyzeLayoffReport } from "@/lib/ai-analysis";
import { insertEvent } from "@/lib/db";
import { refreshDashboardCache } from "@/lib/dashboard-cache";
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
    const now = new Date().toISOString();
    const aiAnalysis = await analyzeLayoffReport({
      title: data.title,
      summary: data.summary,
      sourceName: "Self-reported submission",
      sourceUrl: data.sourceUrl ?? null,
    });

    const reportedAt = normalizeReportedDate(data.reportedAt, now);
    const externalId = createHash("sha256")
      .update(
        [
          data.title,
          data.summary,
          data.company ?? "",
          data.industry,
          data.jobFunction,
          data.country,
          data.impactType,
          reportedAt,
          now,
        ].join("|"),
      )
      .digest("hex");

    const inserted = insertEvent({
      externalId,
      sourceType: "crowd",
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

    refreshDashboardCache();

    return NextResponse.json(
      {
        ok: true,
        message: "Submission recorded and queued in the public aggregate.",
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
