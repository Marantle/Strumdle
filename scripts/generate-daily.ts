/**
 * Build-time script: reads schedule.json, parses the chart for today's date,
 * and writes src/data/today.json for the frontend build.
 *
 * Supports both .chart (text) and .mid (MIDI binary) formats.
 * Auto-detects which file is present in the song folder.
 *
 * Usage:
 *   npm run generate
 *   npm run generate -- --date=2026-03-15
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { parseSongIni } from "./parser/midiParser.ts";
import { ICON_TO_GAME } from "./lib/iconToGame.ts";
import type { SongListEntry } from "../src/types.ts";
import { buildChallenge, type ScheduleEntry } from "./lib/buildChallenge.ts";

// ---------------------------------------------------------------------------
// Resolve "today" in a timezone-safe way
// ---------------------------------------------------------------------------

const dateArg = process.argv.find((a) => a.startsWith("--date="));
const today = dateArg
  ? dateArg.split("=")[1]
  : (process.env.npm_config_date ?? new Date().toISOString().split("T")[0]);

// ---------------------------------------------------------------------------
// Load schedule
// ---------------------------------------------------------------------------

const schedule: ScheduleEntry[] = JSON.parse(
  readFileSync("data/schedule.json", "utf8"),
);
const entry = schedule.find((e) => e.date === today);

if (!entry) {
  console.warn(`⚠ No schedule entry for ${today}. Skipping build.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Build challenge
// ---------------------------------------------------------------------------

const daily = buildChallenge(entry);

// Set countdown to next scheduled challenge
const nextEntry = schedule
  .filter((e) => e.date > today)
  .sort((a, b) => a.date.localeCompare(b.date))[0];
daily.nextChallengeAt = nextEntry
  ? `${nextEntry.date}T01:00:00Z` // 1am UTC
  : undefined;

const outPath = "src/data/today.json";
mkdirSync("src/data", { recursive: true });
writeFileSync(outPath, JSON.stringify(daily, null, 2));

// ---------------------------------------------------------------------------
// Generate enriched song list for autocomplete (from all songs/ directories)
// ---------------------------------------------------------------------------


const songListEntries: SongListEntry[] = [];
for (const dir of readdirSync("data/songs")) {
  const iniPath = join("data/songs", dir, "song.ini");
  if (existsSync(iniPath)) {
    const ini = parseSongIni(readFileSync(iniPath, "utf8"));
    songListEntries.push({
      title: ini.title,
      artist: ini.artist,
      game: ICON_TO_GAME[ini.icon ?? ""] ?? "Unknown",
    });
  } else {
    // Fallback: look up in schedule for legacy songs without song.ini
    const schedEntry = schedule.find((e) => e.chartFile.includes(dir));
    if (schedEntry) {
      songListEntries.push({
        title: schedEntry.title,
        artist: schedEntry.artist,
        game: schedEntry.game ?? "Unknown",
      });
    }
  }
}
// Always include the placeholder #1 song so it can be guessed on that challenge
songListEntries.push({ title: "Dev Riff", artist: "Strumdle", game: "Strumdle" });

// Deduplicate by title (case-insensitive)
const seen = new Set<string>();
const uniqueSongList = songListEntries
  .filter((e) => {
    const key = e.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.title.localeCompare(b.title));

const songListPath = "src/data/songList.json";
writeFileSync(songListPath, JSON.stringify(uniqueSongList, null, 2));
console.log(`  Song list: ${uniqueSongList.length} unique songs for autocomplete`);

console.log(
  `Generated daily #${daily.challengeNumber} for ${today}: ${entry.title} by ${entry.artist}`,
);
console.log(`  Clip: ${entry.startMs}ms – ${entry.startMs + 5000}ms`);
console.log(`  Notes in clip: ${daily.clip.notes.length}`);

// ---------------------------------------------------------------------------
// Warn if schedule is running low
// ---------------------------------------------------------------------------

const futureEntries = schedule.filter((e) => e.date > today).length;
if (futureEntries < 3) {
  console.warn(
    `⚠ Only ${futureEntries} future entries in schedule.json — add more songs!`,
  );
}
