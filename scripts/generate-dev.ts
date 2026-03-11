/**
 * Generate dev puzzle data from the test chart file.
 * Allows `npm run dev` to work without the private data submodule.
 *
 * Outputs src/data/today.json and src/data/songList.json using test/test-song/.
 *
 * Usage: npx tsx scripts/generate-dev.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { parseChart } from "./parser/chartParser.ts";
import { normalize, sliceClip } from "./parser/normalizer.ts";
import type { DailyChallenge, SongListEntry } from "../src/types.ts";
import type { TrackName } from "../src/types.ts";

const TRACK: TrackName = "guitar_expert";
const CHART_PATH = "test/test-song/notes.chart";

if (!existsSync(CHART_PATH)) {
  console.error(`Test chart not found at ${CHART_PATH}`);
  process.exit(1);
}

const content = readFileSync(CHART_PATH, "utf8");
const raw = parseChart(content, TRACK);
const parsed = normalize(raw, TRACK);
const clip = sliceClip(parsed, 0);

const today = new Date().toLocaleDateString("en-CA", { timeZone: "UTC" });

const daily: DailyChallenge = {
  date: today,
  challengeNumber: 0,
  clip,
  answerObfuscated: Buffer.from("Test Riff|Strumdle Dev").toString("base64"),
  aliasesObfuscated: [],
  hints: ["This is a test song for development"],
  maxGuesses: 6,
  game: "Dev Mode",
  nextChallengeAt: undefined,
};

const outDir = "src/data";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/today.json`, JSON.stringify(daily, null, 2));

const songList: SongListEntry[] = [
  { title: "Test Riff", artist: "Strumdle Dev", game: "Dev Mode" },
  { title: "Smoke on the Water", artist: "Deep Purple", game: "Guitar Hero III" },
  { title: "Stairway to Heaven", artist: "Led Zeppelin", game: "Guitar Hero III" },
  { title: "Back in Black", artist: "AC/DC", game: "Guitar Hero II" },
  { title: "Enter Sandman", artist: "Metallica", game: "Guitar Hero: Metallica" },
];
writeFileSync(`${outDir}/songList.json`, JSON.stringify(songList, null, 2));

console.log(`Dev data generated for ${today}`);
console.log(`  Notes in clip: ${clip.notes.length}`);
console.log(`  Song list: ${songList.length} entries (dummy autocomplete data)`);
