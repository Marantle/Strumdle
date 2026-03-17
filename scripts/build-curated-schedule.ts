/**
 * One-off: build the curated launch schedule with 10 iconic songs.
 * Usage: npm run schedule:curated
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseMidi, parseSongIni } from "./parser/midiParser.ts";
import { normalize } from "./parser/normalizer.ts";
import type { TrackName } from "../src/types.ts";
import { ICON_TO_GAME } from "./lib/iconToGame.ts";

const CLIP = 5000;
const TRACK: TrackName = "guitar_expert";

// Songs where the opening riff IS the song — start at 0
const MANUAL_START: Record<string, number> = {
  "sweet-child-o-mine": 0,
  "crazy-train": 0,
  "smells-like-teen-spirit": 0,
  "killing-in-the-name": 0,
  "eye-of-the-tiger": 0,
  "carry-on-wayward-son": 0,
  "livin-on-a-prayer": 0,
};

const songs = [
  "sweet-child-o-mine",       // Day 1 - the arpeggio everyone knows
  "crazy-train",              // Day 2 - iconic opening riff
  "smells-like-teen-spirit",  // Day 3 - unmistakable
  "eye-of-the-tiger",        // Day 4 - picking pattern burned into memory
  "carry-on-wayward-son",    // Day 5 - classic rock staple
  "killing-in-the-name",     // Day 6 - chunky distinctive riff
  "livin-on-a-prayer",       // Day 7 - talk box intro
  "you-give-love-a-bad-name",// Day 8 - punchy riff
  "free-bird",               // Day 9 - the solo
  "through-the-fire-flames", // Day 10 - the legendary shred
];

function findBestStart(slug: string): number {
  if (slug in MANUAL_START) return MANUAL_START[slug];

  const midPath = join("data/songs", slug, "notes.mid");
  const buffer = readFileSync(midPath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const raw = parseMidi(ab, TRACK, { title: "", artist: "" });
  const parsed = normalize(raw, TRACK);
  const noteTimes = parsed.notes.map((n) => n.timeMs).sort((a, b) => a - b);

  if (noteTimes.length < 5) return 0;
  const last = noteTimes[noteTimes.length - 1];

  let bestStart = Math.floor(last * 0.3);
  let bestScore = -Infinity;

  for (let start = Math.floor(last * 0.1); start <= Math.floor(last * 0.7); start += 500) {
    const wn = noteTimes.filter((t) => t >= start && t < start + CLIP);
    if (wn.length < 3) continue;
    const delay = wn[0] - start;
    if (delay > 500) continue;
    let maxGap = delay;
    for (let i = 1; i < wn.length; i++) maxGap = Math.max(maxGap, wn[i] - wn[i - 1]);
    if (maxGap > 1500) continue;
    const score = wn.length - delay * 0.01;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  return bestStart;
}

const schedule: object[] = [];
const epoch = "2026-03-10";

for (let i = 0; i < songs.length; i++) {
  const slug = songs[i];
  const [y, m, d] = epoch.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + i));
  const dateStr = dt.toISOString().split("T")[0];
  const ini = parseSongIni(readFileSync(join("data/songs", slug, "song.ini"), "utf8"));
  const startMs = findBestStart(slug);

  schedule.push({
    date: dateStr,
    chartFile: `data/songs/${slug}`,
    track: "guitar_expert",
    startMs,
    title: ini.title,
    artist: ini.artist,
    hints: [],
    aliases: [],
    game: ICON_TO_GAME[ini.icon ?? ""] ?? "Unknown",
  });
  console.log(`  ${dateStr}: ${ini.title} @ ${startMs}ms`);
}

writeFileSync("data/schedule.json", JSON.stringify(schedule, null, 2));
console.log(`\nSchedule replaced with ${schedule.length} entries`);
