/**
 * Prebuild guard: ensures src/data/today.json was generated for today (UTC).
 * Exits with error if missing or stale, preventing a wrong-day deploy.
 */

import { readFileSync, existsSync } from "fs";

const todayUtc = new Date().toISOString().split("T")[0];
const path = "src/data/today.json";

if (!existsSync(path)) {
  console.error(`✗ ${path} not found. Run: npm run generate`);
  process.exit(1);
}

const { date } = JSON.parse(readFileSync(path, "utf8")) as { date: string };

if (date !== todayUtc) {
  console.error(
    `✗ today.json is for ${date}, but today is ${todayUtc}.\n` +
    `  Re-run: npm run generate`,
  );
  process.exit(1);
}

console.log(`✓ today.json is for ${date} OK`);
