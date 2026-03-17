/**
 * One-off: build the curated launch schedule with 10 iconic songs.
 * Usage: npm run schedule:curated
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseSongIni } from "./parser/midiParser.ts";
import { ICON_TO_GAME } from "./lib/iconToGame.ts";
import { addDays, findBestStart } from "./lib/scheduleUtils.ts";

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

const schedule: object[] = [];
const epoch = "2026-03-10";

for (let i = 0; i < songs.length; i++) {
  const slug = songs[i];
  const dateStr = addDays(epoch, i);
  const ini = parseSongIni(readFileSync(join("data/songs", slug, "song.ini"), "utf8"));
  const startMs = slug in MANUAL_START
    ? MANUAL_START[slug]
    : findBestStart(join("data/songs", slug), ini.songLength ?? 180_000);

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
