import { runIngestion } from "../lib/ingestion";

const intervalMs = 60 * 60 * 1000;

async function tick(trigger: string) {
  const result = await runIngestion(trigger);
  const line = [
    `[${new Date().toISOString()}]`,
    `fetched=${result.fetchedCount}`,
    `inserted=${result.insertedCount}`,
    `skipped=${result.skippedCount}`,
    result.errors.length > 0 ? `errors=${result.errors.length}` : "errors=0",
  ].join(" ");

  console.log(line);
}

async function main() {
  console.log("Starting AI Layoff Radar hourly ingestion worker...");
  await tick("worker-startup");

  setInterval(() => {
    void tick("worker-hourly");
  }, intervalMs);
}

process.on("SIGINT", () => {
  console.log("Stopping worker (SIGINT)");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Stopping worker (SIGTERM)");
  process.exit(0);
});

void main();
