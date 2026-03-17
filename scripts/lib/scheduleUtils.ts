import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parseMidi } from "../parser/midiParser.ts";
import { normalize } from "../parser/normalizer.ts";
import type { TrackName } from "../../src/types.ts";

export const DEFAULT_TRACK: TrackName = "guitar_expert";
export const CLIP_DURATION_MS = 5000;

/** Add N days to a YYYY-MM-DD string, UTC-safe. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0];
}

/** Today's date in YYYY-MM-DD UTC. */
export function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

/** Convert a Node.js Buffer to ArrayBuffer for MIDI parsing. */
export function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Song title/name filter: returns true if the song should be skipped.
 * Excludes co-op variants and guitar battle tracks.
 */
export function isExcludedSong(title: string): boolean {
  return /\(co-?op\)/i.test(title) || /guitar battle/i.test(title);
}

/**
 * Find the best start position for a 5s clip by scoring windows.
 * Prefers windows where:
 * - Notes start within the first 500ms (no silence at the start)
 * - High note density throughout the clip
 * - No gap longer than 1.5s within the clip
 *
 * Falls back to 25–50% of song length if parsing fails.
 */
export function findBestStart(
  songDir: string,
  songLength: number,
  track: TrackName = DEFAULT_TRACK,
): number {
  const midPath = join(songDir, "notes.mid");
  if (!existsSync(midPath)) return fallbackStart(songLength);

  try {
    const buffer = readFileSync(midPath);
    const raw = parseMidi(bufferToArrayBuffer(buffer), track, { title: "", artist: "" });
    const parsed = normalize(raw, track);
    const noteTimes = parsed.notes.map((n) => n.timeMs).sort((a, b) => a - b);

    if (noteTimes.length < 5) return fallbackStart(songLength);

    const lastNote = noteTimes[noteTimes.length - 1];
    const minPos = Math.floor(lastNote * 0.1);
    const maxPos = Math.floor(lastNote * 0.7);

    let bestStart = fallbackStart(songLength);
    let bestScore = -Infinity;

    for (let start = minPos; start <= maxPos; start += 500) {
      const end = start + CLIP_DURATION_MS;
      const windowNotes = noteTimes.filter((t) => t >= start && t < end);
      if (windowNotes.length < 3) continue;

      const firstNoteDelay = windowNotes[0] - start;
      if (firstNoteDelay > 500) continue;

      let maxGap = firstNoteDelay;
      for (let i = 1; i < windowNotes.length; i++) {
        maxGap = Math.max(maxGap, windowNotes[i] - windowNotes[i - 1]);
      }
      if (maxGap > 1500) continue;

      const score = windowNotes.length - firstNoteDelay * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestStart = windowNotes[0];
      }
    }

    return bestStart;
  } catch (e) {
    console.warn(`    Could not parse MIDI for ${songDir}: ${e}`);
    return fallbackStart(songLength);
  }
}

function fallbackStart(songLength: number): number {
  const min = Math.floor(songLength * 0.25);
  const max = Math.floor(songLength * 0.50);
  return min + Math.floor(Math.random() * (max - min));
}
