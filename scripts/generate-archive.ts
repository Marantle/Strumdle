/**
 * Build-time script: generates src/data/archive.json containing all past
 * challenges keyed by challenge number, for instant in-memory lookups.
 *
 * Usage:
 *   npm run generate:archive
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { buildChallenge, type ScheduleEntry } from "./lib/buildChallenge.ts";
import type { DailyChallenge } from "../src/types.ts";

const dateArg = process.argv.find((a) => a.startsWith("--date="));
const today = dateArg
  ? dateArg.split("=")[1]
  : (process.env.npm_config_date ?? new Date().toISOString().split("T")[0]);

if (!existsSync("data/schedule.json")) {
  writeFileSync("src/data/archive.json", "{}");
  console.log("No schedule found — wrote empty archive.json");
  process.exit(0);
}

const schedule: ScheduleEntry[] = JSON.parse(
  readFileSync("data/schedule.json", "utf8"),
);

// Only generate for past entries (not today or future)
const pastEntries = schedule.filter((e) => e.date < today);

const archive: Record<string, DailyChallenge> = {};
let generated = 0;
let failed = 0;

for (const entry of pastEntries) {
  try {
    const challenge = buildChallenge(entry);
    archive[String(challenge.challengeNumber)] = challenge;
    console.log(`  ✓ #${challenge.challengeNumber} ${entry.date}: ${entry.title}`);
    generated++;
  } catch (err) {
    console.warn(`  ✗ ${entry.date} (${entry.title}): ${(err as Error).message}`);
    failed++;
  }
}

writeFileSync("src/data/archive.json", JSON.stringify(archive));
console.log(`\nArchive: ${generated} generated, ${failed} failed.`);
