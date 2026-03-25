/**
 * Script: picks 10 random songs from songs/ and appends
 * schedule entries to schedule.json.
 *
 * Parses each MIDI to find a dense, non-silent start position.
 *
 * Usage: npm run schedule
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parseSongIni } from "./parser/midiParser.ts";
import { ICON_TO_GAME } from "./lib/iconToGame.ts";
import { addDays, findBestStart, isExcludedSong } from "./lib/scheduleUtils.ts";
import type { ScheduleEntry } from "./lib/buildChallenge.ts";

// Load existing schedule
const schedule: ScheduleEntry[] = JSON.parse(
  readFileSync("data/schedule.json", "utf8"),
);

// Find the last date in schedule
const lastDate = schedule
  .map((e) => e.date)
  .sort()
  .pop() ?? "2026-03-12";

// Collect all songs with song.ini, split into fresh (never scheduled) and repeat pools
const scheduledTitles = new Set(schedule.map((e) => e.title.toLowerCase()));
type Candidate = { slug: string; title: string; artist: string; game: string; songLength: number };
const freshCandidates: Candidate[] = [];
const repeatCandidates: Candidate[] = [];

for (const dir of readdirSync("data/songs")) {
  const iniPath = join("data/songs", dir, "song.ini");
  if (!existsSync(iniPath)) continue;

  const ini = parseSongIni(readFileSync(iniPath, "utf8"));

  // Skip co-op variants, guitar battles, and bonus songs
  if (isExcludedSong(ini.title)) continue;
  if (existsSync(join("data/songs", dir, "bonus"))) continue;

  const entry = {
    slug: dir,
    title: ini.title,
    artist: ini.artist,
    game: ICON_TO_GAME[ini.icon ?? ""] ?? "Unknown",
    songLength: ini.songLength ?? 180_000,
  };

  if (scheduledTitles.has(ini.title.toLowerCase())) {
    repeatCandidates.push(entry);
  } else {
    freshCandidates.push(entry);
  }
}

console.log(`${freshCandidates.length} fresh songs, ${repeatCandidates.length} repeat songs`);

// Shuffle both pools
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
shuffle(freshCandidates);
shuffle(repeatCandidates);

// Pick 10: exhaust fresh first, then fill from repeats
const picked = [
  ...freshCandidates.slice(0, 10).map((s) => ({ ...s, isRepeat: false })),
  ...repeatCandidates.slice(0, Math.max(0, 10 - freshCandidates.length)).map((s) => ({ ...s, isRepeat: true })),
];

let nextDate = addDays(lastDate, 1);
for (const song of picked) {
  const dateStr = nextDate;
  nextDate = addDays(dateStr, 1);

  const startMs = song.isRepeat
    ? findBestStart(join("data/songs", song.slug), song.songLength)
    : 0;

  const entry: ScheduleEntry = {
    date: dateStr,
    chartFile: `data/songs/${song.slug}`,
    track: "guitar_expert",
    startMs,
    title: song.title,
    artist: song.artist,
    hints: [],
    aliases: [],
    game: song.game,
  };

  schedule.push(entry);
  console.log(`  ${dateStr}: ${song.title} by ${song.artist} [${song.game}] @ ${startMs}ms`);
}

writeFileSync("data/schedule.json", JSON.stringify(schedule, null, 2));
console.log(`\nSchedule now has ${schedule.length} entries`);
