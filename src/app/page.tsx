import { RadarDashboard } from "@/components/radar-dashboard";
import { getDashboardDataFromCache } from "@/lib/dashboard-cache";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = getDashboardDataFromCache();

  return <RadarDashboard initialData={data} />;
}
