# Strumdle Audio System

## Overview

Custom Web Audio API system with per-lane sound assignment. Notes play when they hit the strikeline during chart playback. No external audio libraries — just the browser's built-in AudioContext.

## Sound Catalog

### Real recorded samples (.ogg files)

These use actual guitar recordings from Freesound.org (see `LANE_AUDIO_ATTRIBUTION.md` for full credits and licenses).

| Sound | Description | Source | Files |
|-------|-------------|--------|-------|
| **Real Guitar** | Heavy power chord samples | Ax_Grinder (CC BY 3.0) | `hit0-4.ogg`, `sustain0-4.ogg` |
| **Funk Guitar** | Clean funky strat notes | guitarmaster + Skirox (CC0) | `funk-hit0-4.ogg`, `funk-sustain0-4.ogg` |

Each has 5 hit samples (one per lane) and 5 sustain samples. Hit plays on note start, sustain crossfades in at ~200ms for held notes.

Samples are **prefetched** as raw ArrayBuffers on module load (before any user interaction), then decoded when AudioContext is created on first Play press.

### Synthesized sounds (Web Audio oscillators)

These are generated entirely in code via Web Audio API oscillators, filters, and envelopes. No audio files involved.

| Sound | Description | Technique |
|-------|-------------|-----------|
| **Bass** | Deep bass pluck | Sawtooth oscillator, dropped an octave, noise burst exciter |
| **Harmonic** | Pure ringing harmonic | Sine oscillator with slow decay |
| **Bell** | Metallic chime | Triangle oscillator with inharmonic partials |
| **Synth Lead** | Filtered square wave | Square oscillator through lowpass filter |
| **Retro** | 8-bit game bleep | Square oscillator, short decay, no filter |
| **Tap** | Percussive click | Noise burst through bandpass filter, very short decay |

All synth sounds use the guitar open-string frequency mapping: E3, A3, D4, G4, B4 (lanes 0–4).

## Per-Lane Assignment

Each of the 5 lanes (Green, Red, Yellow, Blue, Orange) can be assigned any sound independently. There's also a "Set all lanes" shortcut.

Settings (lane sounds + mute state) persist in `localStorage` under key `strumdle-audio`, with forward/backward compatibility — unknown sound IDs from future/past versions fall back to "Real Guitar".

## Audio Pipeline

```
BufferSource / Oscillator → per-note GainNode → masterGain → DynamicsCompressor → destination
```

- **DynamicsCompressor**: threshold -12dB, ratio 4:1, knee 6dB — prevents clipping when many notes hit simultaneously
- **Master volume**: 0.7 default

## Adding a New Sample-Based Sound

1. Add its `SoundId` to the union type
2. Add it to `SOUND_CATALOG`
3. Add `() => {}` for it in `SYNTH_MAP` (sample playback is handled separately)
4. Add an entry in `SAMPLE_SETS` with hit and sustain file paths (one per lane)
5. Place the .ogg files in `public/sounds/`

### Preparing samples with ffmpeg

Current files are **Ogg Vorbis, 48 kHz, mono, ~q5**. Target durations:

| Type | Duration | Purpose |
|------|----------|---------|
| Hit | ~0.3–0.6s | Short attack/transient, plays on note start |
| Sustain | ~7s | Loopable tail, crossfades in at ~200ms for held notes |

You need **5 hits** and **5 sustains** (one per lane: green, red, yellow, blue, orange), ideally at different pitches.

**Convert and trim a source file to a hit sample:**

```bash
ffmpeg -i source.wav -ss 0 -t 0.4 -ac 1 -ar 48000 -c:a libvorbis -q:a 5 -af "afade=t=out:st=0.25:d=0.15" hit0.ogg
```

**Convert and trim a source file to a sustain sample:**

```bash
ffmpeg -i source.wav -ss 0.1 -t 7 -ac 1 -ar 48000 -c:a libvorbis -q:a 5 -af "afade=t=in:d=0.05,afade=t=out:st=6.5:d=0.5" sustain0.ogg
```

**Key flags:**
- `-ac 1` — mono (required)
- `-ar 48000` — 48 kHz sample rate (matches existing files)
- `-c:a libvorbis -q:a 5` — Ogg Vorbis, quality ~5 (good balance of size vs quality)
- `-ss` / `-t` — start offset and duration for trimming
- `-af "afade=..."` — fade in/out to avoid clicks at boundaries

**Naming convention:** `{prefix}-hit{0-4}.ogg` and `{prefix}-sustain{0-4}.ogg` (e.g., `jazz-hit0.ogg`)

## Adding a New Synthesized Sound

1. Add its `SoundId` to the union type
2. Add it to `SOUND_CATALOG`
3. Write a `synthXxx()` function using Web Audio nodes
4. Add it to `SYNTH_MAP`
