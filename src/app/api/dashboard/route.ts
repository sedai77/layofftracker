import { NextRequest, NextResponse } from "next/server";

import { getDashboardDataFromCache } from "@/lib/dashboard-cache";
import { ensureFreshIngestion } from "@/lib/ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const country = params.get("country") ?? undefined;
    const industry = params.get("industry") ?? undefined;

    let data = getDashboardDataFromCache({ country, industry });

    if (data.summary.totalSignals === 0) {
      try {
        await ensureFreshIngestion(24 * 60);
        data = getDashboardDataFromCache({ country, industry });
      } catch {
        // Return cache-only response even if ingestion fails.
      }
    }

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
