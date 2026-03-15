// What gets baked into the build as today.json
export interface DailyChallenge {
  date: string; // "2026-03-10"
  challengeNumber: number; // day 1, 2, 3... derived from date
  clip: PublicClipData;
  clipSongStartMs?: number; // start position in original song timeline (ms)
  answerObfuscated: string; // btoa(title + "|" + artist)
  aliasesObfuscated: string[]; // btoa() of each alias
  hints: string[]; // up to 3 hints, revealed after guesses 2, 3, 4
  maxGuesses: number; // 6
  game?: string; // which Guitar Hero game, e.g. "Guitar Hero II"
  nextChallengeAt?: string | undefined; // ISO 8601 UTC timestamp for next daily build
}

export interface SongListEntry {
  title: string;
  artist: string;
  game: string;
}

export interface PublicClipData {
  track: TrackName;
  clipStartMs: number;
  clipEndMs: number;
  tempos: TempoEvent[];
  notes: NoteEvent[];
}

export interface TempoEvent {
  timeMs: number;
  bpm: number;
}

export interface NoteEvent {
  timeMs: number;
  lane: Lane;
  lengthMs: number;
}

export type Lane = 0 | 1 | 2 | 3 | 4;

export type TrackName =
  | "guitar_expert"
  | "guitar_hard"
  | "guitar_medium"
  | "guitar_easy"
  | "bass_expert"
  | "bass_hard"
  | "bass_medium"
  | "bass_easy";

// Stored in localStorage key: daily-{YYYY-MM-DD}
export interface DailyResult {
  date: string;
  guesses: string[];
  solved: boolean;
  solvedOnAttempt: number | null;
}

// Game state machine
export type GameState =
  | "loading"
  | "ready"
  | "playing"
  | "idle"
  | "correct"
  | "fail"
  | "done";
