/**
 * Parse Guitar Hero / Clone Hero MIDI files (notes.mid) into the same
 * RawParsedChart format used by the .chart parser.
 *
 * GH MIDI format:
 * - Standard MIDI file (SMF type 1, multiple tracks)
 * - Tempo map is in the first track (conductor track)
 * - Notes are in named tracks: "PART GUITAR", "PART BASS", etc.
 * - Expert difficulty notes are MIDI notes 96-100 (green=96 ... orange=100)
 * - Hard: 84-88, Medium: 72-76, Easy: 60-64
 * - Sustains = note duration (note-on to note-off)
 */

import type { TrackName } from '../../src/types.ts';
import type { RawParsedChart } from './chartParser.ts';

// ---------------------------------------------------------------------------
// MIDI note ranges per difficulty
// ---------------------------------------------------------------------------

const DIFFICULTY_RANGES: Record<string, Record<string, number>> = {
  expert: { green: 96, red: 97, yellow: 98, blue: 99, orange: 100 },
  hard:   { green: 84, red: 85, yellow: 86, blue: 87, orange: 88 },
  medium: { green: 72, red: 73, yellow: 74, blue: 75, orange: 76 },
  easy:   { green: 60, red: 61, yellow: 62, blue: 63, orange: 64 },
};

// Map TrackName to MIDI track name + difficulty
const TRACK_MAP: Record<TrackName, { midiTrack: string; difficulty: string }> = {
  guitar_expert: { midiTrack: 'PART GUITAR', difficulty: 'expert' },
  guitar_hard:   { midiTrack: 'PART GUITAR', difficulty: 'hard' },
  guitar_medium: { midiTrack: 'PART GUITAR', difficulty: 'medium' },
  guitar_easy:   { midiTrack: 'PART GUITAR', difficulty: 'easy' },
  bass_expert:   { midiTrack: 'PART BASS', difficulty: 'expert' },
  bass_hard:     { midiTrack: 'PART BASS', difficulty: 'hard' },
  bass_medium:   { midiTrack: 'PART BASS', difficulty: 'medium' },
  bass_easy:     { midiTrack: 'PART BASS', difficulty: 'easy' },
};

// ---------------------------------------------------------------------------
// Low-level MIDI binary reading
// ---------------------------------------------------------------------------

class MidiReader {
  private view: DataView;
  private pos = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get offset() { return this.pos; }
  get remaining() { return this.view.byteLength - this.pos; }

  readUint8(): number {
    return this.view.getUint8(this.pos++);
  }

  readUint16(): number {
    const val = this.view.getUint16(this.pos);
    this.pos += 2;
    return val;
  }

  readUint32(): number {
    const val = this.view.getUint32(this.pos);
    this.pos += 4;
    return val;
  }

  readString(n: number): string {
    const bytes = new Uint8Array(this.view.buffer, this.pos, n);
    this.pos += n;
    return new TextDecoder('ascii').decode(bytes);
  }

  readVarLen(): number {
    let value = 0;
    let byte: number;
    do {
      byte = this.readUint8();
      value = (value << 7) | (byte & 0x7F);
    } while (byte & 0x80);
    return value;
  }

  skip(n: number) {
    this.pos += n;
  }
}

// ---------------------------------------------------------------------------
// MIDI track parsing
// ---------------------------------------------------------------------------

interface MidiNoteEvent {
  tick: number;
  note: number;
  on: boolean; // true = note-on, false = note-off
}

interface MidiTempoEvent {
  tick: number;
  bpm: number;
}

interface MidiTrack {
  name: string;
  tempos: MidiTempoEvent[];
  noteEvents: MidiNoteEvent[];
}

function parseMidiFile(buffer: ArrayBuffer): {
  ticksPerQuarter: number;
  tracks: MidiTrack[];
} {
  const reader = new MidiReader(buffer);

  // Header
  const headerChunk = reader.readString(4);
  if (headerChunk !== 'MThd') {
    throw new Error(`Not a MIDI file: expected MThd, got "${headerChunk}"`);
  }
  const headerLen = reader.readUint32();
  if (headerLen !== 6) throw new Error(`Unexpected header length: ${headerLen}`);

  const format = reader.readUint16();
  const numTracks = reader.readUint16();
  const division = reader.readUint16();

  if (division & 0x8000) {
    throw new Error('SMPTE time division not supported');
  }
  if (format !== 0 && format !== 1) {
    throw new Error(`MIDI format ${format} not supported`);
  }

  const ticksPerQuarter = division;
  const tracks: MidiTrack[] = [];

  for (let t = 0; t < numTracks; t++) {
    if (reader.remaining < 8) break;

    const chunkId = reader.readString(4);
    const chunkLen = reader.readUint32();

    if (chunkId !== 'MTrk') {
      reader.skip(chunkLen);
      continue;
    }

    const trackEnd = reader.offset + chunkLen;
    const track: MidiTrack = { name: '', tempos: [], noteEvents: [] };

    let tick = 0;
    let runningStatus = 0;

    while (reader.offset < trackEnd) {
      const delta = reader.readVarLen();
      tick += delta;

      let statusByte = reader.readUint8();

      // Running status: if high bit not set, it's a data byte
      if (statusByte < 0x80) {
        statusByte = runningStatus;
        reader.skip(-1);
      } else if (statusByte < 0xF0) {
        runningStatus = statusByte;
      }

      const type = statusByte & 0xF0;

      if (type === 0x90) {
        const note = reader.readUint8();
        const velocity = reader.readUint8();
        track.noteEvents.push({
          tick,
          note,
          on: velocity > 0, // velocity 0 = note-off
        });
      } else if (type === 0x80) {
        const note = reader.readUint8();
        reader.readUint8(); // velocity
        track.noteEvents.push({ tick, note, on: false });
      } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
        reader.skip(2);
      } else if (type === 0xC0 || type === 0xD0) {
        reader.skip(1);
      } else if (statusByte === 0xFF) {
        // Meta event
        const metaType = reader.readUint8();
        const metaLen = reader.readVarLen();

        if (metaType === 0x03) {
          // Track name
          track.name = reader.readString(metaLen);
        } else if (metaType === 0x51 && metaLen === 3) {
          // Tempo: 3 bytes = microseconds per quarter note
          const b1 = reader.readUint8();
          const b2 = reader.readUint8();
          const b3 = reader.readUint8();
          const uspq = (b1 << 16) | (b2 << 8) | b3;
          track.tempos.push({ tick, bpm: 60_000_000 / uspq });
        } else if (metaType === 0x2F) {
          // End of track
          reader.skip(metaLen);
          break;
        } else {
          reader.skip(metaLen);
        }
      } else if (statusByte === 0xF0 || statusByte === 0xF7) {
        // SysEx
        const len = reader.readVarLen();
        reader.skip(len);
      } else {
        // Unknown: bail to avoid infinite loop
        break;
      }
    }

    // Ensure we land at track end
    if (reader.offset < trackEnd) {
      reader.skip(trackEnd - reader.offset);
    }

    tracks.push(track);
  }

  return { ticksPerQuarter, tracks };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a MIDI buffer into a RawParsedChart.
 *
 * @param buffer  Raw binary content of a .mid file (as ArrayBuffer).
 * @param track   Which track/difficulty to extract.
 * @param meta    Optional metadata (from song.ini or schedule.json).
 */
export function parseMidi(
  buffer: ArrayBuffer,
  track: TrackName,
  meta?: { title?: string; artist?: string },
): RawParsedChart {
  const { ticksPerQuarter, tracks } = parseMidiFile(buffer);
  const mapping = TRACK_MAP[track];

  // --- Collect tempo events from all tracks (usually track 0) ---
  const syncTrack: { tick: number; bpm: number }[] = [];
  for (const t of tracks) {
    for (const tempo of t.tempos) {
      syncTrack.push({ tick: tempo.tick, bpm: tempo.bpm });
    }
  }
  syncTrack.sort((a, b) => a.tick - b.tick);
  if (syncTrack.length === 0) {
    syncTrack.push({ tick: 0, bpm: 120 });
  }

  // --- Find the instrument track ---
  const instrTrack = tracks.find(
    (t) => t.name.toUpperCase() === mapping.midiTrack.toUpperCase(),
  );
  if (!instrTrack) {
    const available = tracks.map((t) => `"${t.name}"`).filter((n) => n !== '""');
    throw new Error(
      `MIDI track "${mapping.midiTrack}" not found. Available tracks: ${available.join(', ')}`,
    );
  }

  // --- Build note-to-lane map for the requested difficulty ---
  const diffRange = DIFFICULTY_RANGES[mapping.difficulty];
  const noteToLane = new Map<number, number>();
  noteToLane.set(diffRange.green, 0);
  noteToLane.set(diffRange.red, 1);
  noteToLane.set(diffRange.yellow, 2);
  noteToLane.set(diffRange.blue, 3);
  noteToLane.set(diffRange.orange, 4);

  // --- Pair note-ons with note-offs ---
  const notes: { tick: number; lane: number; sustainTicks: number }[] = [];

  // Track pending note-ons per MIDI note number
  const pending = new Map<number, number>(); // midiNote → tick of note-on

  for (const ev of instrTrack.noteEvents) {
    const lane = noteToLane.get(ev.note);
    if (lane === undefined) continue;

    if (ev.on) {
      pending.set(ev.note, ev.tick);
    } else {
      const onTick = pending.get(ev.note);
      if (onTick !== undefined) {
        notes.push({
          tick: onTick,
          lane,
          sustainTicks: ev.tick - onTick,
        });
        pending.delete(ev.note);
      }
    }
  }

  notes.sort((a, b) => a.tick - b.tick || a.lane - b.lane);

  // --- Metadata ---
  const title = meta?.title ?? 'Unknown Title';
  const artist = meta?.artist ?? 'Unknown Artist';

  return {
    song: { title, artist },
    resolution: ticksPerQuarter,
    syncTrack,
    timeSignatures: [],
    notes,
  };
}

// ---------------------------------------------------------------------------
// song.ini parser
// ---------------------------------------------------------------------------

/**
 * Parse a song.ini file to extract metadata.
 */
export function parseSongIni(content: string): {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: string;
  charter?: string;
  icon?: string;
  songLength?: number;
} {
  const kv = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(\w+)\s*=\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2].trim().replace(/<\/?color[^>]*>/g, '');
      kv.set(key, value);
    }
  }
  return {
    title: kv.get('name') ?? 'Unknown Title',
    artist: kv.get('artist') ?? 'Unknown Artist',
    album: kv.get('album'),
    genre: kv.get('genre'),
    year: kv.get('year'),
    charter: kv.get('charter'),
    icon: kv.get('icon'),
    songLength: kv.get('song_length') ? parseInt(kv.get('song_length')!, 10) : undefined,
  };
}
