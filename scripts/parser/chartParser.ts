/**
 * Parse Guitar Hero .chart files into a tick-based intermediate representation.
 *
 * .chart is an INI-style text format with sections like [Song], [SyncTrack],
 * and difficulty/instrument tracks such as [ExpertSingle].
 */

import type { TrackName } from '../../src/types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawParsedChart {
  song: { title: string; artist: string; charter?: string; year?: number };
  resolution: number;
  syncTrack: { tick: number; bpm: number }[];
  timeSignatures: { tick: number; numerator: number }[];
  notes: { tick: number; lane: number; sustainTicks: number }[];
}

// ---------------------------------------------------------------------------
// Track-name → section-name mapping
// ---------------------------------------------------------------------------

const SECTION_MAP: Record<TrackName, string> = {
  guitar_expert: 'ExpertSingle',
  guitar_hard: 'HardSingle',
  guitar_medium: 'MediumSingle',
  guitar_easy: 'EasySingle',
  bass_expert: 'ExpertDoubleBass',
  bass_hard: 'HardDoubleBass',
  bass_medium: 'MediumDoubleBass',
  bass_easy: 'EasyDoubleBass',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Split a .chart file into named sections.
 * Returns a map from section name (without brackets) to the lines inside that
 * section's curly-brace block.
 */
function splitSections(content: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  const lines = content.split(/\r?\n/);

  let currentName: string | null = null;
  let currentLines: string[] = [];
  let insideBlock = false;

  for (const raw of lines) {
    const line = raw.trim();

    // Detect section header: [SectionName]
    const headerMatch = line.match(/^\[(.+)]$/);
    if (headerMatch) {
      currentName = headerMatch[1];
      currentLines = [];
      insideBlock = false;
      continue;
    }

    if (line === '{') {
      insideBlock = true;
      continue;
    }

    if (line === '}') {
      if (currentName !== null) {
        sections.set(currentName, currentLines);
      }
      insideBlock = false;
      currentName = null;
      continue;
    }

    if (insideBlock && currentName !== null) {
      currentLines.push(line);
    }
  }

  return sections;
}

/**
 * Parse the [Song] section into metadata key/value pairs.
 */
function parseSongSection(lines: string[]): {
  title: string;
  artist: string;
  charter?: string;
  year?: number;
  resolution: number;
} {
  const kv = new Map<string, string>();

  for (const line of lines) {
    const match = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      // Strip surrounding quotes from values
      const value = match[2].trim().replace(/^"(.*)"$/, '$1');
      kv.set(match[1], value);
    }
  }

  const resolution = parseInt(kv.get('Resolution') ?? '192', 10);
  const yearRaw = kv.get('Year');
  const yearParsed = yearRaw ? parseInt(yearRaw.replace(/\D/g, ''), 10) : undefined;

  return {
    title: kv.get('Name') ?? 'Unknown Title',
    artist: kv.get('Artist') ?? 'Unknown Artist',
    charter: kv.get('Charter') ?? undefined,
    year: yearParsed && !Number.isNaN(yearParsed) ? yearParsed : undefined,
    resolution,
  };
}

/**
 * Parse the [SyncTrack] section for BPM and time-signature events.
 */
function parseSyncTrack(lines: string[]): {
  syncTrack: { tick: number; bpm: number }[];
  timeSignatures: { tick: number; numerator: number }[];
} {
  const syncTrack: { tick: number; bpm: number }[] = [];
  const timeSignatures: { tick: number; numerator: number }[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s*=\s*(\w+)\s+(.+)$/);
    if (!match) continue;

    const tick = parseInt(match[1], 10);
    const type = match[2];
    const rest = match[3].trim();

    if (type === 'B') {
      // BPM value is stored as bpm * 1000 (e.g. 120000 = 120 BPM)
      const bpm = parseInt(rest, 10) / 1000;
      syncTrack.push({ tick, bpm });
    } else if (type === 'TS') {
      const numerator = parseInt(rest, 10);
      timeSignatures.push({ tick, numerator });
    }
  }

  return { syncTrack, timeSignatures };
}

/**
 * Parse a note section (e.g. [ExpertSingle]) for note events.
 * Skips star-power (S) and text-event (E) lines.
 */
function parseNoteSection(
  lines: string[],
): { tick: number; lane: number; sustainTicks: number }[] {
  const notes: { tick: number; lane: number; sustainTicks: number }[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s*=\s*(\w+)\s+(.+)$/);
    if (!match) continue;

    const tick = parseInt(match[1], 10);
    const type = match[2];

    // Only process note (N) events
    if (type !== 'N') continue;

    const parts = match[3].trim().split(/\s+/);
    const lane = parseInt(parts[0], 10);
    const sustainTicks = parseInt(parts[1] ?? '0', 10);

    // Only accept valid lane values 0–4
    if (lane < 0 || lane > 4) continue;

    notes.push({ tick, lane, sustainTicks });
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a .chart file's text content into a tick-based intermediate structure.
 *
 * @param content  The raw text of the .chart file.
 * @param track    Which track to extract (e.g. "guitar_expert").
 * @returns        A RawParsedChart with tick-based timing.
 */
export function parseChart(content: string, track: TrackName): RawParsedChart {
  const sections = splitSections(content);

  // --- Song metadata ---
  const songLines = sections.get('Song');
  if (!songLines) {
    throw new Error('.chart file is missing [Song] section');
  }
  const { title, artist, charter, year, resolution } = parseSongSection(songLines);

  // --- Sync track ---
  const syncLines = sections.get('SyncTrack');
  if (!syncLines) {
    throw new Error('.chart file is missing [SyncTrack] section');
  }
  const { syncTrack, timeSignatures } = parseSyncTrack(syncLines);

  // --- Note track ---
  const sectionName = SECTION_MAP[track];
  if (!sectionName) {
    throw new Error(`Unknown track name: ${track}`);
  }
  const noteLines = sections.get(sectionName);
  if (!noteLines) {
    throw new Error(
      `[${sectionName}] section not found in .chart file. Available sections: ${[...sections.keys()].join(', ')}`,
    );
  }
  const notes = parseNoteSection(noteLines);

  return {
    song: { title, artist, charter, year },
    resolution,
    syncTrack,
    timeSignatures,
    notes,
  };
}
