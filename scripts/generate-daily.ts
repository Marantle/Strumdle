/**
 * Build-time script: reads schedule.json, parses the chart for today's date,
 * and writes src/data/today.json for the frontend build.
 *
 * Supports both .chart (text) and .mid (MIDI binary) formats.
 * Auto-detects which file is present in the song folder.
 *
 * Usage:
 *   npx tsx scripts/generate-daily.ts
 *   npx tsx scripts/generate-daily.ts --date 2026-03-15
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { parseChart } from "./parser/chartParser.ts";
import { parseMidi, parseSongIni } from "./parser/midiParser.ts";
import { normalize, sliceClip } from "./parser/normalizer.ts";
import type { DailyChallenge, SongListEntry } from "../src/types.ts";
import type { TrackName } from "../src/types.ts";

// ---------------------------------------------------------------------------
// Resolve "today" in a timezone-safe way
// ---------------------------------------------------------------------------

const dateArg = process.argv.find((a) => a.startsWith("--date="));
const today = dateArg
  ? dateArg.split("=")[1]
  : new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// ---------------------------------------------------------------------------
// Load schedule
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  date: string;
  chartFile: string; // path to song folder OR specific .chart file
  track: string;
  startMs: number;
  title: string;
  artist: string;
  hints: string[];
  aliases?: string[];
  game?: string;
}

const schedule: ScheduleEntry[] = JSON.parse(
  readFileSync("data/schedule.json", "utf8"),
);
const entry = schedule.find((e) => e.date === today);

if (!entry) {
  console.warn(`⚠ No schedule entry for ${today}. Skipping build.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Auto-detect chart format and parse
// ---------------------------------------------------------------------------

const track = entry.track as TrackName;

function loadChart(path: string) {
  // If path points directly to a .chart file
  if (path.endsWith(".chart")) {
    const content = readFileSync(path, "utf8");
    return parseChart(content, track);
  }

  // If path points directly to a .mid file
  if (path.endsWith(".mid")) {
    const buffer = readFileSync(path);
    const meta = tryLoadSongIni(dirname(path));
    return parseMidi(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), track, meta);
  }

  // If path is a directory, auto-detect
  const dir = path;

  // Try notes.chart first
  const chartPath = join(dir, "notes.chart");
  if (existsSync(chartPath)) {
    console.log(`  Format: .chart (text)`);
    const content = readFileSync(chartPath, "utf8");
    return parseChart(content, track);
  }

  // Try notes.mid
  const midPath = join(dir, "notes.mid");
  if (existsSync(midPath)) {
    console.log(`  Format: .mid (MIDI binary)`);
    const buffer = readFileSync(midPath);
    const meta = tryLoadSongIni(dir);
    return parseMidi(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), track, meta);
  }

  throw new Error(
    `No notes.chart or notes.mid found in "${dir}". ` +
    `Available files: ${readdirSafe(dir).join(', ')}`,
  );
}

function tryLoadSongIni(dir: string): { title?: string; artist?: string } | undefined {
  const iniPath = join(dir, "song.ini");
  if (existsSync(iniPath)) {
    const ini = parseSongIni(readFileSync(iniPath, "utf8"));
    console.log(`  song.ini: ${ini.title} by ${ini.artist}`);
    return { title: ini.title, artist: ini.artist };
  }
  return undefined;
}

function readdirSafe(dir: string): string[] {
  try {
    const { readdirSync } = require("fs");
    return readdirSync(dir);
  } catch {
    return ['(could not read directory)'];
  }
}

const raw = loadChart(entry.chartFile);
const parsed = normalize(raw, track);

// ---------------------------------------------------------------------------
// Slice clip
// ---------------------------------------------------------------------------

const clip = sliceClip(parsed, entry.startMs);

// ---------------------------------------------------------------------------
// Build output
// ---------------------------------------------------------------------------

const EPOCH = new Date("2026-03-10").getTime();
const challengeNumber =
  Math.floor((new Date(today).getTime() - EPOCH) / 86_400_000) + 1;

const answer = `${entry.title}|${entry.artist}`;

// Find next scheduled date after today for countdown timer
const nextEntry = schedule
  .filter((e) => e.date > today)
  .sort((a, b) => a.date.localeCompare(b.date))[0];
const nextChallengeAt = nextEntry
  ? `${nextEntry.date}T05:00:00Z` // 5am UTC = midnight Eastern
  : undefined;

const daily: DailyChallenge = {
  date: today,
  challengeNumber,
  clip,
  answerObfuscated: Buffer.from(answer).toString("base64"),
  aliasesObfuscated: (entry.aliases ?? []).map((a) =>
    Buffer.from(a).toString("base64"),
  ),
  hints: entry.hints,
  maxGuesses: 6,
  game: entry.game,
  nextChallengeAt,
};

const outPath = "src/data/today.json";
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(daily, null, 2));

// ---------------------------------------------------------------------------
// Generate enriched song list for autocomplete (from all songs/ directories)
// ---------------------------------------------------------------------------

const ICON_TO_GAME: Record<string, string> = {
  gh1: "Guitar Hero",
  gh2: "Guitar Hero II",
  gh3: "Guitar Hero III",
  ghm: "Guitar Hero: Metallica",
  gh5: "Guitar Hero 5",
  ghwt: "Guitar Hero: World Tour",
};

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
  `Generated daily #${challengeNumber} for ${today}: ${entry.title} by ${entry.artist}`,
);
console.log(`  Clip: ${entry.startMs}ms – ${entry.startMs + 5000}ms`);
console.log(`  Notes in clip: ${clip.notes.length}`);

// ---------------------------------------------------------------------------
// Warn if schedule is running low
// ---------------------------------------------------------------------------

const futureEntries = schedule.filter((e) => e.date > today).length;
if (futureEntries < 3) {
  console.warn(
    `⚠ Only ${futureEntries} future entries in schedule.json — add more songs!`,
  );
}
