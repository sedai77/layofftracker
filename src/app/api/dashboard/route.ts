import { NextRequest, NextResponse } from "next/server";

import { getDashboardDataFromCache } from "@/lib/dashboard-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const country = params.get("country") ?? undefined;
    const industry = params.get("industry") ?? undefined;

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
