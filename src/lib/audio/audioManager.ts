/**
 * Audio manager with 12 distinct sound types, individually assignable per lane.
 *
 * Synthesis approaches:
 * - Resonant noise (plucked string family)
 * - Oscillator-based (synth family)
 * - Percussive (click/tap family)
 * - Hybrid combinations
 */

import type { Lane } from "../../types";

// ---- Sound catalog ----

export type SoundId =
  | "real"
  | "funk"
  | "bass"
  | "harmonic"
  | "bell"
  | "synth"
  | "retro"
  | "tap";

export interface SoundDef {
  id: SoundId;
  name: string;
  description: string;
}

export const SOUND_CATALOG: SoundDef[] = [
  { id: "real",      name: "Real Guitar",  description: "Recorded power chord samples" },
  { id: "funk",      name: "Funk Guitar",  description: "Recorded short, clean, funky guitar notes" },
  { id: "bass",      name: "Bass",        description: "Virtual deep bass pluck" },
  { id: "harmonic",  name: "Harmonic",    description: "Virtual pure ringing harmonic" },
  { id: "bell",      name: "Bell",        description: "Virtual metallic chime" },
  { id: "synth",     name: "Synth Lead",  description: "Virtual filtered square wave" },
  { id: "retro",     name: "Retro",       description: "Virtual 8-bit game bleep" },
  { id: "tap",       name: "Tap",         description: "Virtual percussive click" },
];

// Base frequencies per lane (E3, A3, D4, G4, B4 - guitar open strings)
const LANE_FREQ = [164.81, 220.0, 293.66, 392.0, 493.88];

// Lane display colors (for UI)
export const LANE_NAMES = ["Green", "Red", "Yellow", "Blue", "Orange"];

// ---- Noise buffer ----

let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.ceil(ctx.sampleRate * 0.06);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const fade = Math.min(64, length);
  for (let i = 0; i < fade; i++) {
    const e = i / fade;
    data[i] *= e;
    data[length - 1 - i] *= e;
  }
  return noiseBuffer;
}

// ---- Synthesis functions ----
// Each takes (ctx, masterGain, freq, now) and wires its own nodes.

type SynthFn = (
  ctx: AudioContext,
  dest: GainNode,
  freq: number,
  now: number,
) => void;


function synthBass(ctx: AudioContext, dest: GainNode, freq: number, now: number) {
  const noise = getNoiseBuffer(ctx);
  const f = freq * 0.5; // Drop an octave
  resonantLayer(ctx, dest, noise, f, 30, 0.45, 0.8, now);
  resonantLayer(ctx, dest, noise, f * 2, 20, 0.12, 0.4, now);
  // Sub rumble
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(g);
  g.connect(dest);
  osc.start(now);
  osc.stop(now + 0.55);
}


function synthHarmonic(ctx: AudioContext, dest: GainNode, freq: number, now: number) {
  // Pure sine harmonics: bell-like natural harmonic
  const f = freq * 2; // Harmonic is usually an octave up
  for (const [mult, gain, decay] of [
    [1, 0.3, 1.2],
    [2, 0.12, 0.8],
    [3, 0.06, 0.5],
  ] as [number, number, number][]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }
}


function synthBell(ctx: AudioContext, dest: GainNode, freq: number, now: number) {
  // Inharmonic partials: metallic bell/chime
  const f = freq * 2;
  const partials: [number, number, number][] = [
    [1.0, 0.25, 1.5],
    [2.76, 0.12, 1.0],
    [5.4, 0.06, 0.6],
    [8.93, 0.03, 0.3],
  ];
  for (const [ratio, gain, decay] of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }
}

function synthSynth(ctx: AudioContext, dest: GainNode, freq: number, now: number) {
  // Filtered square wave with sweep
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = freq;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(freq * 8, now);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.4);
  lp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.connect(lp);
  lp.connect(g);
  g.connect(dest);
  osc.start(now);
  osc.stop(now + 0.45);
}

function synthRetro(ctx: AudioContext, dest: GainNode, freq: number, now: number) {
  // 8-bit style: short square bleep
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = freq;
  // Pitch bend down
  osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.06);
  g.gain.linearRampToValueAtTime(0, now + 0.12);
  osc.connect(g);
  g.connect(dest);
  osc.start(now);
  osc.stop(now + 0.15);
}

function synthTap(ctx: AudioContext, dest: GainNode, freq: number, now: number) {
  // Pure percussive: tuned click with quick pitch drop
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq * 3, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(g);
  g.connect(dest);
  osc.start(now);
  osc.stop(now + 0.1);
  // Noise click
  pickTransient(ctx, dest, now, 0.2);
}

// Map sound IDs to their synth function.
// Sample-based sounds use () => {}; playback is handled by AudioManager.
const SYNTH_MAP: Record<SoundId, SynthFn> = {
  real: () => {},
  funk: () => {},
  bass: synthBass,
  harmonic: synthHarmonic,
  bell: synthBell,
  synth: synthSynth,
  retro: synthRetro,
  tap: synthTap,
};

// ---- Shared helpers ----

function resonantLayer(
  ctx: AudioContext,
  dest: GainNode,
  noise: AudioBuffer,
  freq: number,
  Q: number,
  peakGain: number,
  decaySec: number,
  startTime: number,
) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = Q;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(freq * 6, 16000), startTime);
  lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.8, 80), startTime + decaySec);
  lp.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + decaySec);
  source.connect(bp);
  bp.connect(lp);
  lp.connect(gain);
  gain.connect(dest);
  source.start(startTime);
}

function pickTransient(
  ctx: AudioContext,
  dest: GainNode,
  startTime: number,
  volume: number,
) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 4000;
  hp.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02);
  source.connect(hp);
  hp.connect(gain);
  gain.connect(dest);
  source.start(startTime);
  source.stop(startTime + 0.03);
}

// ---- Sustained note wrapper ----
// Re-uses the hit synth + adds a held oscillator tail for sounds that support it.

function playSustainedWithSynth(
  ctx: AudioContext,
  dest: GainNode,
  soundId: SoundId,
  freq: number,
  durationMs: number,
  now: number,
) {
  // Initial hit
  SYNTH_MAP[soundId](ctx, dest, freq, now);

  // Add sustain tail for tonal sounds
  if (soundId === "tap" || soundId === "retro") return;

  const durSec = durationMs / 1000;
  const osc = ctx.createOscillator();
  osc.type = soundId === "synth" ? "square" : "sawtooth";
  osc.frequency.value = soundId === "bass" ? freq * 0.5 : freq;

  // Vibrato
  const vib = ctx.createOscillator();
  const vibG = ctx.createGain();
  vib.frequency.value = 5.5;
  vibG.gain.value = freq * 0.006;
  vib.connect(vibG);
  vibG.connect(osc.frequency);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(freq * 4, now);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.5, now + durSec);
  lp.Q.value = 1;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.1, now + 0.08);
  if (durSec > 0.2) {
    g.gain.setValueAtTime(0.1, now + durSec - 0.1);
  }
  g.gain.exponentialRampToValueAtTime(0.001, now + durSec + 0.15);

  osc.connect(lp);
  lp.connect(g);
  g.connect(dest);
  osc.start(now);
  vib.start(now);
  osc.stop(now + durSec + 0.2);
  vib.stop(now + durSec + 0.2);
}

// ---- AudioManager class ----

// ---- Sample file paths ----
// To add a new real-instrument sound:
//   1. Add its SoundId to the SoundId union type above
//   2. Add it to SOUND_CATALOG with a name/description
//   3. Add () => {} for it in SYNTH_MAP
//   4. Add an entry here with hit and sustain file paths (one per lane)

interface SampleSetPaths {
  hits: string[];
  sustains: string[];
}

const SAMPLE_SETS: Partial<Record<SoundId, SampleSetPaths>> = {
  real: {
    hits: [
      "/sounds/hit0.mp3",
      "/sounds/hit1.mp3",
      "/sounds/hit2.mp3",
      "/sounds/hit3.mp3",
      "/sounds/hit4.mp3",
    ],
    sustains: [
      "/sounds/sustain0.mp3",
      "/sounds/sustain1.mp3",
      "/sounds/sustain2.mp3",
      "/sounds/sustain3.mp3",
      "/sounds/sustain4.mp3",
    ],
  },
  funk: {
    hits: [
      "/sounds/funk-hit0.mp3",
      "/sounds/funk-hit1.mp3",
      "/sounds/funk-hit2.mp3",
      "/sounds/funk-hit3.mp3",
      "/sounds/funk-hit4.mp3",
    ],
    sustains: [
      "/sounds/funk-sustain0.mp3",
      "/sounds/funk-sustain1.mp3",
      "/sounds/funk-sustain2.mp3",
      "/sounds/funk-sustain3.mp3",
      "/sounds/funk-sustain4.mp3",
    ],
  },
};

// Prefetched raw ArrayBuffers (no AudioContext needed)
const prefetchedBuffers = new Map<string, Promise<ArrayBuffer>>();

function prefetchSamples() {
  for (const paths of Object.values(SAMPLE_SETS)) {
    if (!paths) continue;
    for (const url of [...paths.hits, ...paths.sustains]) {
      if (!prefetchedBuffers.has(url)) {
        prefetchedBuffers.set(
          url,
          fetch(url).then((r) => r.arrayBuffer()).catch(() => new ArrayBuffer(0)),
        );
      }
    }
  }
}

// Start prefetching immediately on module load
prefetchSamples();

const STORAGE_KEY = "strumdle-audio";
const DEFAULT_SOUND: SoundId = "real";
const VALID_SOUND_IDS = new Set<string>(SOUND_CATALOG.map((s) => s.id));

function isValidSoundId(id: unknown): id is SoundId {
  return typeof id === "string" && VALID_SOUND_IDS.has(id);
}

function loadAudioPrefs(): { laneSounds: SoundId[]; muted: boolean } {
  const defaults = { laneSounds: Array(5).fill(DEFAULT_SOUND) as SoundId[], muted: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const muted = typeof parsed.muted === "boolean" ? parsed.muted : false;
    if (!Array.isArray(parsed.laneSounds)) return { ...defaults, muted };
    // Validate each lane, falling back to default for unknown/removed sounds
    const laneSounds = Array.from({ length: 5 }, (_, i) =>
      isValidSoundId(parsed.laneSounds[i]) ? parsed.laneSounds[i] : DEFAULT_SOUND,
    );
    return { laneSounds, muted };
  } catch {
    return defaults;
  }
}

function saveAudioPrefs(laneSounds: SoundId[], muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ laneSounds, muted }));
  } catch { /* quota exceeded, ignore */ }
}

class AudioManager {
  private initialized = false;
  private muted: boolean;
  private volume = 0.13;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Per-lane sound assignment
  private laneSounds: SoundId[];

  constructor() {
    const prefs = loadAudioPrefs();
    this.laneSounds = prefs.laneSounds;
    this.muted = prefs.muted;
  }

  // Loaded sample buffers keyed by SoundId
  private loadedSamples = new Map<SoundId, { hits: (AudioBuffer | null)[]; sustains: (AudioBuffer | null)[] }>();
  private samplesLoaded = false;

  async initialize() {
    if (this.initialized) return;
    try {
      this.audioContext = new AudioContext();
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 6;
      compressor.ratio.value = 4;
      compressor.connect(this.audioContext.destination);
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(compressor);
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      getNoiseBuffer(this.audioContext);
      this.initialized = true;

      // Decode prefetched samples in the background, don't block initialize()
      // so the first user gesture returns quickly and doesn't inflate INP
      this.loadSamples().catch(console.error);
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      throw error;
    }
  }

  private async loadSamples() {
    if (this.samplesLoaded || !this.audioContext) return;
    const ctx = this.audioContext;

    const load = async (url: string): Promise<AudioBuffer | null> => {
      try {
        // Use prefetched ArrayBuffer if available
        const arrayBuf = prefetchedBuffers.has(url)
          ? await prefetchedBuffers.get(url)!
          : await fetch(url).then((r) => r.arrayBuffer());
        if (arrayBuf.byteLength === 0) return null;
        return await ctx.decodeAudioData(arrayBuf.slice(0));
      } catch {
        console.warn(`Failed to load sample: ${url}`);
        return null;
      }
    };

    for (const [id, paths] of Object.entries(SAMPLE_SETS) as [SoundId, typeof SAMPLE_SETS[SoundId]][]) {
      if (!paths) continue;
      const [hits, sustains] = await Promise.all([
        Promise.all(paths.hits.map(load)),
        Promise.all(paths.sustains.map(load)),
      ]);
      this.loadedSamples.set(id, { hits, sustains });
    }

    this.samplesLoaded = true;
    console.log("Samples loaded:", [...this.loadedSamples.keys()].join(", "));
  }

  // ---- Per-lane sound config ----

  setLaneSound(lane: Lane, sound: SoundId) {
    this.laneSounds[lane] = sound;
    saveAudioPrefs(this.laneSounds, this.muted);
  }

  getLaneSound(lane: Lane): SoundId {
    return this.laneSounds[lane];
  }

  getLaneSounds(): SoundId[] {
    return [...this.laneSounds];
  }

  /** Set all lanes to the same sound at once */
  setAllLanes(sound: SoundId) {
    this.laneSounds = [sound, sound, sound, sound, sound];
    saveAudioPrefs(this.laneSounds, this.muted);
  }

  // ---- Compat: old preset API (maps to setAllLanes) ----

  setPreset(preset: SoundId) {
    this.setAllLanes(preset);
  }

  getPreset(): SoundId {
    return this.laneSounds[0];
  }

  getPresetName(): string {
    return SOUND_CATALOG.find((s) => s.id === this.laneSounds[0])?.name ?? "Guitar";
  }

  getAllPresets(): Array<{ id: SoundId; name: string }> {
    return SOUND_CATALOG.map((s) => ({ id: s.id, name: s.name }));
  }

  // ---- Mute / volume ----

  setMuted(muted: boolean) { this.muted = muted; saveAudioPrefs(this.laneSounds, this.muted); }
  isMuted(): boolean { return this.muted; }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }
  getVolume(): number { return this.volume; }

  // ---- Playback ----

  async playNoteHit(lane: Lane) {
    if (!this.initialized || this.muted || !this.audioContext || !this.masterGain) return;
    if (this.audioContext.state === "suspended") await this.audioContext.resume();

    const sound = this.laneSounds[lane];
    if (sound in SAMPLE_SETS) {
      this.playSampleHit(sound, lane);
    } else {
      SYNTH_MAP[sound](this.audioContext, this.masterGain, LANE_FREQ[lane], this.audioContext.currentTime);
    }
  }

  async playSustainedNote(lane: Lane, durationMs: number) {
    if (!this.initialized || this.muted || !this.audioContext || !this.masterGain) return;
    if (this.audioContext.state === "suspended") await this.audioContext.resume();

    const sound = this.laneSounds[lane];
    if (sound in SAMPLE_SETS) {
      this.playSampleSustain(sound, lane, durationMs);
    } else {
      playSustainedWithSynth(
        this.audioContext, this.masterGain, sound, LANE_FREQ[lane], durationMs, this.audioContext.currentTime,
      );
    }
  }

  /** Preview a specific sound on a lane (for the config UI) */
  async preview(lane: Lane, sound: SoundId) {
    if (!this.initialized || !this.audioContext || !this.masterGain) {
      await this.initialize();
    }
    if (!this.audioContext || !this.masterGain) return;
    if (this.audioContext.state === "suspended") await this.audioContext.resume();

    if (sound in SAMPLE_SETS) {
      this.playSampleHit(sound, lane);
    } else {
      SYNTH_MAP[sound](this.audioContext, this.masterGain, LANE_FREQ[lane], this.audioContext.currentTime);
    }
  }

  // ---- Sample playback ----

  private playSampleHit(sound: SoundId, lane: Lane) {
    const buf = this.loadedSamples.get(sound)?.hits[lane] ?? null;
    if (!buf || !this.audioContext || !this.masterGain) return;

    const src = this.audioContext.createBufferSource();
    src.buffer = buf;
    const g = this.audioContext.createGain();
    g.gain.value = 1.0;
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  private playSampleSustain(sound: SoundId, lane: Lane, durationMs: number) {
    const set = this.loadedSamples.get(sound);
    const hitBuf = set?.hits[lane] ?? null;
    const sustainBuf = set?.sustains[lane] ?? null;
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const durSec = durationMs / 1000;

    // Play the hit sample (attack)
    if (hitBuf) {
      const hitSrc = ctx.createBufferSource();
      hitSrc.buffer = hitBuf;
      const hitG = ctx.createGain();
      hitG.gain.setValueAtTime(1.0, now);
      // Crossfade out the hit over 200ms as sustain takes over
      if (sustainBuf && durSec > 0.3) {
        hitG.gain.setValueAtTime(1.0, now + 0.15);
        hitG.gain.linearRampToValueAtTime(0, now + 0.35);
      }
      hitSrc.connect(hitG);
      hitG.connect(this.masterGain);
      hitSrc.start(now);
    }

    // Play the sustain sample (looped if needed)
    if (sustainBuf && durSec > 0.1) {
      const susSrc = ctx.createBufferSource();
      susSrc.buffer = sustainBuf;
      // Loop if the sustain is longer than the sample
      if (durSec > sustainBuf.duration) {
        susSrc.loop = true;
        susSrc.loopStart = 0.2; // skip initial transient on loop
        susSrc.loopEnd = sustainBuf.duration - 0.05;
      }

      const susG = ctx.createGain();
      // Fade in the sustain to crossfade with the hit
      susG.gain.setValueAtTime(0, now);
      susG.gain.linearRampToValueAtTime(0.8, now + 0.2);
      // Hold
      susG.gain.setValueAtTime(0.8, now + Math.max(0.25, durSec - 0.15));
      // Fade out at end
      susG.gain.exponentialRampToValueAtTime(0.001, now + durSec + 0.1);

      susSrc.connect(susG);
      susG.connect(this.masterGain);
      susSrc.start(now);
      susSrc.stop(now + durSec + 0.15);
    }
  }

  stopAll() {
    // Fire-and-forget envelopes: nodes self-terminate
  }
}

// Re-export SoundPreset as alias for backward compat
export type SoundPreset = SoundId;

export const audioManager = new AudioManager();
