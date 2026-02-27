import { NextResponse } from "next/server";

import { getIngestionSourceCatalog } from "@/lib/ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sources = getIngestionSourceCatalog();

  return NextResponse.json({
    ok: true,
    totalSources: sources.length,
    byChannel: {
      news: sources.filter((source) => source.channel === "news").length,
      publication: sources.filter((source) => source.channel === "publication")
        .length,
      community: sources.filter((source) => source.channel === "community").length,
    },
    sources,
  });
}
