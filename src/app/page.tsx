import { RadarDashboard } from "@/components/radar-dashboard";
import { getDashboardDataFromCache } from "@/lib/dashboard-cache";
import { ensureFreshIngestion } from "@/lib/ingestion";

export const dynamic = "force-dynamic";
const DEFAULT_INGEST_REFRESH_MINUTES = 5;

export default async function HomePage() {
  try {
    await ensureFreshIngestion(parseRefreshWindowMinutes(process.env.APP_INGEST_REFRESH_MINUTES));
  } catch {
    // Keep page rendering even when upstream sources fail.
  }

  const data = getDashboardDataFromCache();
  return <RadarDashboard initialData={data} />;
}

function parseRefreshWindowMinutes(value: string | undefined): number {
  const parsed = Number(value ?? DEFAULT_INGEST_REFRESH_MINUTES);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_INGEST_REFRESH_MINUTES;
  }

  return Math.max(1, Math.min(60, Math.floor(parsed)));
}
