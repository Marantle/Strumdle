import type { NoteEvent } from "../../types";

export interface RendererState {
  notes: NoteEvent[];
  clipDurationMs: number; // always 5000
  songStartMs: number; // absolute song timeline position for elapsed=0
  startTime: number | null; // performance.now() when playback started
  rafId: number | null;
  playedNotes: Set<string>; // Track which notes have been played (avoid retriggering)
  audioEnabled: boolean; // Whether audio is enabled
}

export interface RendererConfig {
  canvasWidth: number;
  canvasHeight: number;

  // Perspective: the highway is a trapezoid. At the top (vanishing end) it's
  // narrower; at the strikeline (bottom) it's the full width.
  strikelineY: number; // y position of the fret buttons (near bottom)
  topY: number; // y position where notes appear (vanishing point area)
  topScale: number; // how narrow the highway is at the top (0.3 = 30% of bottom width)

  // The full highway width at the strikeline (bottom)
  highwayWidth: number;

  scrollSpeed: number; // px/ms in the linear (pre-perspective) space
  noteHeight: number; // base note gem height at strikeline
  fretRadius: number; // radius of the fret button circles
}

export const DEFAULT_CONFIG: RendererConfig = {
  canvasWidth: 300,
  canvasHeight: 500,
  strikelineY: 430,
  topY: 40,
  topScale: 0.35,
  highwayWidth: 280,
  scrollSpeed: 0.25,
  noteHeight: 14,
  fretRadius: 18,
};

export const LANE_COLORS = [
  "#00C800",
  "#C80000",
  "#C8C800",
  "#0064FF",
  "#FF8C00",
] as const;

// Darker versions for fret buttons in idle state
export const LANE_COLORS_DIM = [
  "#004400",
  "#440000",
  "#444400",
  "#002244",
  "#442200",
] as const;
