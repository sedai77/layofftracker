import { NextRequest, NextResponse } from "next/server";

import { runIngestion } from "@/lib/ingestion";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleIngestionRequest(request, "cron-get");
}

export async function POST(request: NextRequest) {
  return handleIngestionRequest(request, "cron-post");
}

async function handleIngestionRequest(request: NextRequest, trigger: string) {
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret) {
    const authHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const querySecret = request.nextUrl.searchParams.get("secret");

    if (authHeader !== expectedSecret && querySecret !== expectedSecret) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }
  }

  const result = await runIngestion(trigger);
  return NextResponse.json({
    ok: true,
    result,
  });
}
