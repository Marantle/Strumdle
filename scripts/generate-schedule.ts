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
import { parseMidi, parseSongIni } from "./parser/midiParser.ts";
import { normalize } from "./parser/normalizer.ts";
import type { TrackName } from "../src/types.ts";

const CLIP_DURATION = 5000; // 5 seconds
const TRACK: TrackName = "guitar_expert";

const ICON_TO_GAME: Record<string, string> = {
  gh1: "Guitar Hero",
  gh2: "Guitar Hero II",
  gh3: "Guitar Hero III",
  ghm: "Guitar Hero: Metallica",
  gh5: "Guitar Hero 5",
  ghwt: "Guitar Hero: World Tour",
};

interface ScheduleEntry {
  date: string;
  chartFile: string;
  track: string;
  startMs: number;
  title: string;
  artist: string;
  hints: string[];
  aliases: string[];
  game: string;
}

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
  if (ini.title.includes("(Co-op)")) continue;
  if (ini.title.includes("Guitar Battle")) continue;
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

/**
 * Find the best start position for a clip by scoring 5s windows.
 * Prefers windows where:
 * - Notes start within the first 500ms (no silence at the start)
 * - High note density throughout the clip
 * - No gap longer than 1.5s within the clip
 *
 * Falls back to 25-50% of song length if parsing fails.
 */
function findBestStart(slug: string, songLength: number): number {
  const midPath = join("data/songs", slug, "notes.mid");
  if (!existsSync(midPath)) {
    return fallbackStart(songLength);
  }

  try {
    const buffer = readFileSync(midPath);
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const iniPath = join("data/songs", slug, "song.ini");
    const meta = existsSync(iniPath)
      ? { title: "", artist: "" }
      : undefined;
    const raw = parseMidi(ab, TRACK, meta);
    const parsed = normalize(raw, TRACK);

    const noteTimes = parsed.notes.map((n) => n.timeMs).sort((a, b) => a - b);
    if (noteTimes.length < 5) return fallbackStart(songLength);

    const lastNote = noteTimes[noteTimes.length - 1];
    // Candidate start positions: every 500ms from 10% to 70% of the song
    const minPos = Math.floor(lastNote * 0.1);
    const maxPos = Math.floor(lastNote * 0.7);
    const step = 500;

    let bestStart = fallbackStart(songLength);
    let bestScore = -Infinity;

    for (let start = minPos; start <= maxPos; start += step) {
      const end = start + CLIP_DURATION;

      // Notes in this window
      const windowNotes = noteTimes.filter((t) => t >= start && t < end);
      if (windowNotes.length < 3) continue;

      // Time to first note from start (smaller is better)
      const firstNoteDelay = windowNotes[0] - start;
      if (firstNoteDelay > 500) continue; // Skip if silence > 500ms at start

      // Check for gaps > 1.5s within the window
      let maxGap = firstNoteDelay;
      for (let i = 1; i < windowNotes.length; i++) {
        maxGap = Math.max(maxGap, windowNotes[i] - windowNotes[i - 1]);
      }
      if (maxGap > 1500) continue; // Skip windows with big silent gaps

      // Score: note count, penalize first-note delay
      const score = windowNotes.length - firstNoteDelay * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestStart = windowNotes[0]; // snap to first note hit
      }
    }

    return bestStart;
  } catch (e) {
    console.warn(`    Could not parse MIDI for ${slug}: ${e}`);
    return fallbackStart(songLength);
  }
}

function fallbackStart(songLength: number): number {
  const minStart = Math.floor(songLength * 0.25);
  const maxStart = Math.floor(songLength * 0.50);
  return minStart + Math.floor(Math.random() * (maxStart - minStart));
}

// Shuffle and pick 10
for (let i = candidates.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}
const picked = candidates.slice(0, 10);

// Generate entries — use string date math to avoid timezone issues
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split("T")[0];
}

let nextDate = addDays(lastDate, 1);
for (const song of picked) {
  const dateStr = nextDate;
  nextDate = addDays(dateStr, 1);

  const startMs = findBestStart(song.slug, song.songLength);

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
