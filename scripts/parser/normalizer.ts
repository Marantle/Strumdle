/**
 * Convert tick-based raw parsed chart data into millisecond-based output,
 * and extract fixed-length clips for the game.
 */

import type {
  PublicClipData,
  TempoEvent,
  NoteEvent,
  Lane,
  TrackName,
} from '../../src/types.ts';
import type { RawParsedChart } from './chartParser.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedChart {
  song: { title: string; artist: string; charter?: string; year?: number };
  track: TrackName;
  durationMs: number;
  tempos: TempoEvent[];
  notes: NoteEvent[];
}

// ---------------------------------------------------------------------------
// Tick → millisecond conversion
// ---------------------------------------------------------------------------

/**
 * Convert a tick position to a millisecond timestamp by accumulating tempo
 * changes from the tempo map.
 *
 * @param tick        The target tick to convert.
 * @param tempoMap    Sorted array of tempo events (tick + bpm).
 * @param resolution  Ticks per quarter note (from the [Song] section).
 * @returns           The corresponding time in milliseconds (rounded).
 */
export function ticksToMs(
  tick: number,
  tempoMap: { tick: number; bpm: number }[],
  resolution: number,
): number {
  let ms = 0;
  let lastTick = 0;
  let lastBpm = 120;

  for (const event of tempoMap) {
    if (event.tick >= tick) break;
    ms += ((event.tick - lastTick) / resolution) * (60_000 / lastBpm);
    lastTick = event.tick;
    lastBpm = event.bpm;
  }

  ms += ((tick - lastTick) / resolution) * (60_000 / lastBpm);
  return Math.round(ms);
}

// ---------------------------------------------------------------------------
// Normalize: ticks → ms
// ---------------------------------------------------------------------------

/**
 * Convert a RawParsedChart (tick-based) into a ParsedChart (ms-based).
 *
 * @param raw    The tick-based intermediate representation from chartParser.
 * @param track  The track name to embed in the output.
 * @returns      A fully ms-based ParsedChart.
 */
export function normalize(raw: RawParsedChart, track: TrackName): ParsedChart {
  const { syncTrack, resolution } = raw;

  // Convert tempo events to ms
  const tempos: TempoEvent[] = syncTrack.map((t) => ({
    timeMs: ticksToMs(t.tick, syncTrack, resolution),
    bpm: t.bpm,
  }));

  // Convert note events to ms
  const notes: NoteEvent[] = raw.notes.map((n) => {
    const timeMs = ticksToMs(n.tick, syncTrack, resolution);
    const endMs = ticksToMs(n.tick + n.sustainTicks, syncTrack, resolution);
    return {
      timeMs,
      lane: n.lane as Lane,
      lengthMs: endMs - timeMs,
    };
  });

  // Duration is the latest note end or the last note start, whichever is greater
  let durationMs = 0;
  for (const n of notes) {
    const end = n.timeMs + n.lengthMs;
    if (end > durationMs) durationMs = end;
  }

  return {
    song: raw.song,
    track,
    durationMs,
    tempos,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Clip extraction
// ---------------------------------------------------------------------------

const CLIP_DURATION_MS = 15_000; // 15 seconds of content to support multiple guesses
const CLIP_OFFSET_MS = 1_000; // Add 1 second of empty space at the start

/**
 * Extract a 5-second clip from a parsed chart starting at the given offset.
 *
 * @param parsed   The full ms-based parsed chart.
 * @param startMs  The start time of the clip window (in ms).
 * @returns        A PublicClipData object with times relative to clip start.
 */
export function sliceClip(parsed: ParsedChart, startMs: number): PublicClipData {
  // Snap startMs forward to the first note in the window so there's no
  // silence beyond the CLIP_OFFSET_MS lead-in.
  const firstNote = parsed.notes.find((n) => n.timeMs >= startMs);
  if (firstNote && firstNote.timeMs > startMs) {
    startMs = firstNote.timeMs;
  }

  const endMs = startMs + CLIP_DURATION_MS;

  // --- Tempos within the clip ---
  // Find the active tempo at clip start: the last tempo event at or before startMs.
  let activeTempo: TempoEvent = { timeMs: 0, bpm: 120 };
  for (const t of parsed.tempos) {
    if (t.timeMs <= startMs) {
      activeTempo = t;
    } else {
      break; // tempos are sorted by timeMs
    }
  }

  // Start with the active tempo shifted to the offset time
  const clipTempos: TempoEvent[] = [{ timeMs: CLIP_OFFSET_MS, bpm: activeTempo.bpm }];

  // Add any tempo changes that fall strictly within the window
  for (const t of parsed.tempos) {
    if (t.timeMs > startMs && t.timeMs < endMs) {
      clipTempos.push({ timeMs: t.timeMs - startMs + CLIP_OFFSET_MS, bpm: t.bpm });
    }
  }

  // --- Notes within the clip ---
  const clipNotes: NoteEvent[] = [];
  for (const n of parsed.notes) {
    if (n.timeMs >= startMs && n.timeMs < endMs) {
      const shiftedTime = n.timeMs - startMs + CLIP_OFFSET_MS;
      const truncatedLength = Math.min(n.lengthMs, endMs - n.timeMs);
      clipNotes.push({
        timeMs: shiftedTime,
        lane: n.lane,
        lengthMs: truncatedLength,
      });
    }
  }

  return {
    track: parsed.track,
    clipStartMs: 0,
    clipEndMs: CLIP_DURATION_MS + CLIP_OFFSET_MS,
    tempos: clipTempos,
    notes: clipNotes,
  };
}
