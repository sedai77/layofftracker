import { getDashboardCachePath, refreshDashboardCache } from "../lib/dashboard-cache";

const cache = refreshDashboardCache();

console.log(
  JSON.stringify(
    {
      cachePath: getDashboardCachePath(),
      generatedAt: cache.generatedAt,
      lastIngestedAt: cache.lastIngestedAt,
      cachedViews: Object.keys(cache.dashboardByKey).length,
      events: cache.events.length,
    },
    null,
    2,
  ),
);
