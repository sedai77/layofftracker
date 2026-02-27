import { NextRequest, NextResponse } from "next/server";

import { getDashboardDataFromCache } from "@/lib/dashboard-cache";
import { ensureFreshIngestion } from "@/lib/ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_INGEST_REFRESH_MINUTES = 5;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const country = params.get("country") ?? undefined;
    const industry = params.get("industry") ?? undefined;
    const refreshWindowMinutes = parseRefreshWindowMinutes(
      process.env.APP_INGEST_REFRESH_MINUTES,
    );

    try {
      await ensureFreshIngestion(refreshWindowMinutes);
    } catch {
      // Return cache-only response even when ingestion fails.
    }

    const data = getDashboardDataFromCache({ country, industry });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Unable to generate dashboard",
        message,
      },
      {
        status: 500,
      },
    );
  }
}

function parseRefreshWindowMinutes(value: string | undefined): number {
  const parsed = Number(value ?? DEFAULT_INGEST_REFRESH_MINUTES);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INGEST_REFRESH_MINUTES;
  }

  return Math.max(1, Math.min(60, Math.floor(parsed)));
}
