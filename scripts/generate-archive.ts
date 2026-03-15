/**
 * Build-time script: generates src/data/archive.json containing all past
 * challenges keyed by challenge number, for instant in-memory lookups.
 *
 * Usage:
 *   npm run generate:archive
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { buildChallenge, getChallengeNumber, EPOCH, type ScheduleEntry } from "./lib/buildChallenge.ts";
import type { DailyChallenge } from "../src/types.ts";

const EPOCH_DATE = new Date(EPOCH).toISOString().split("T")[0];

// Placeholder challenge injected as #1 when the EPOCH date has no schedule entry
const PLACEHOLDER_1: DailyChallenge = {
  date: EPOCH_DATE,
  challengeNumber: getChallengeNumber(EPOCH_DATE),
  answerObfuscated: Buffer.from("Dev Riff|Strumdle").toString("base64"),
  aliasesObfuscated: [],
  hints: [],
  maxGuesses: 6,
  clip: {
    track: "guitar_expert",
    clipStartMs: 0,
    clipEndMs: 5000,
    tempos: [{ timeMs: 0, bpm: 120 }],
    // Simple ascending then descending riff at 120 BPM (500ms per beat)
    notes: [
      { timeMs: 0,    lane: 0, lengthMs: 100 },
      { timeMs: 500,  lane: 1, lengthMs: 100 },
      { timeMs: 1000, lane: 2, lengthMs: 100 },
      { timeMs: 1500, lane: 3, lengthMs: 100 },
      { timeMs: 2000, lane: 4, lengthMs: 100 },
      { timeMs: 2500, lane: 3, lengthMs: 100 },
      { timeMs: 3000, lane: 2, lengthMs: 100 },
      { timeMs: 3500, lane: 1, lengthMs: 100 },
      { timeMs: 4000, lane: 0, lengthMs: 100 },
      { timeMs: 4500, lane: 2, lengthMs: 100 },
    ],
  },
};

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

// Inject placeholder #1 upfront if the EPOCH date has no scheduled song
const hasEpochEntry = pastEntries.some((e) => e.date === EPOCH_DATE);
if (!hasEpochEntry) {
  archive["1"] = PLACEHOLDER_1;
  console.log(`  ✓ #1 ${EPOCH_DATE}: Dev Riff (placeholder)`);
}

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
