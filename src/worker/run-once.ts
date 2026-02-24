import { runIngestion } from "../lib/ingestion";

async function main() {
  const result = await runIngestion("manual-cli");
  console.log(JSON.stringify(result, null, 2));
}

void main().finally(() => {
  process.exit(0);
});
