import { useRef, useEffect, useCallback } from "react";
import type { NoteEvent } from "../types";
import { render } from "../lib/renderer/highway";
import type { RendererState } from "../lib/renderer/types";
import { DEFAULT_CONFIG } from "../lib/renderer/types";
import { audioManager } from "../lib/audio/audioManager";

interface ChartHighwayProps {
  notes: NoteEvent[];
  clipDurationMs: number;
  songStartMs?: number;
  playing: boolean;
  onPlaybackComplete: () => void;
}

export default function ChartHighway({
  notes,
  clipDurationMs,
  songStartMs = 0,
  playing,
  onPlaybackComplete,
}: ChartHighwayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RendererState>({
    notes,
    clipDurationMs,
    songStartMs,
    startTime: null,
    rafId: null,
    playedNotes: new Set<string>(),
    audioEnabled: true,
  });

  // Keep notes and audio state in sync
  useEffect(() => {
    stateRef.current.notes = notes;
    stateRef.current.clipDurationMs = clipDurationMs;
    stateRef.current.songStartMs = songStartMs;
    stateRef.current.audioEnabled = !audioManager.isMuted();
  }, [notes, clipDurationMs, songStartMs]);

  // Set canvas dimensions once on mount (resizing on every play causes expensive layout reflow)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DEFAULT_CONFIG.canvasWidth * dpr;
    canvas.height = DEFAULT_CONFIG.canvasHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // Initialize audio on component mount to avoid first-note delay
  useEffect(() => {
    audioManager.initialize().catch(console.error);
  }, []);

  const stop = useCallback(() => {
    if (stateRef.current.rafId !== null) {
      cancelAnimationFrame(stateRef.current.rafId);
      stateRef.current.rafId = null;
    }
    // Clear played notes when stopping
    stateRef.current.playedNotes.clear();
    audioManager.stopAll();
  }, []);

  useEffect(() => {
    if (!playing) {
      stop();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    stateRef.current.playedNotes.clear(); // Reset played notes on new playback

    stateRef.current.startTime = performance.now();

    function loop(now: number) {
      const stillPlaying = render(ctx!, stateRef.current, now);
      if (stillPlaying) {
        stateRef.current.rafId = requestAnimationFrame(loop);
      } else {
        stateRef.current.rafId = null;
        onPlaybackComplete();
      }
    }

    stateRef.current.rafId = requestAnimationFrame(loop);

    return stop;
  }, [playing, onPlaybackComplete, stop]);

  // Draw initial static frame when not playing
  useEffect(() => {
    if (playing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render at time 0 to show the initial state of the clip
    const fakeState: RendererState = {
      notes,
      clipDurationMs,
      songStartMs,
      startTime: performance.now(),
      playedNotes: new Set<string>(),
      audioEnabled: false,
      rafId: null,
    };
    render(ctx, fakeState, performance.now());
  }, [notes, clipDurationMs, songStartMs, playing]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[300px] mx-auto block aspect-[3/5]"
    />
  );
}
