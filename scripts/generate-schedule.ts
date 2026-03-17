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

// Collect all songs with song.ini
const scheduledTitles = new Set(schedule.map((e) => e.title.toLowerCase()));
const candidates: {
  slug: string;
  title: string;
  artist: string;
  game: string;
  songLength: number;
}[] = [];

for (const dir of readdirSync("data/songs")) {
  const iniPath = join("data/songs", dir, "song.ini");
  if (!existsSync(iniPath)) continue;

  const ini = parseSongIni(readFileSync(iniPath, "utf8"));

  // Skip already scheduled, co-op variants, guitar battles, and bonus songs
  if (scheduledTitles.has(ini.title.toLowerCase())) continue;
  if (isExcludedSong(ini.title)) continue;
  if (existsSync(join("data/songs", dir, "bonus"))) continue;

  candidates.push({
    slug: dir,
    title: ini.title,
    artist: ini.artist,
    game: ICON_TO_GAME[ini.icon ?? ""] ?? "Unknown",
    songLength: ini.songLength ?? 180_000,
  });
}

console.log(`${candidates.length} eligible songs (excluding scheduled, co-op, battles)`);

// Shuffle and pick 10
for (let i = candidates.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}
const picked = candidates.slice(0, 10);

let nextDate = addDays(lastDate, 1);
for (const song of picked) {
  const dateStr = nextDate;
  nextDate = addDays(dateStr, 1);

  const startMs = findBestStart(join("data/songs", song.slug), song.songLength);

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
