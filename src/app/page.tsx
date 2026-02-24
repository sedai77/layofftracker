import { RadarDashboard } from "@/components/radar-dashboard";
import { getDashboardDataFromCache } from "@/lib/dashboard-cache";
import { ensureFreshIngestion } from "@/lib/ingestion";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let data = getDashboardDataFromCache();

  if (data.summary.totalSignals === 0) {
    try {
      await ensureFreshIngestion(24 * 60);
      data = getDashboardDataFromCache();
    } catch {
      // Keep page rendering even when upstream sources fail.
    }
  }

  return <RadarDashboard initialData={data} />;
}
