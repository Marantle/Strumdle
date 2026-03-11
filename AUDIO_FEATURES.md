# Strumdle Audio System

## Overview
Integrated Strudel (a JavaScript port of Tidal Cycles) to play notes when they hit the strikeline during chart playback.

## Features Implemented

### 1. Audio Manager (`src/lib/audio/audioManager.ts`)
- Singleton manager for all audio playback
- Initializes Strudel's Web Audio on demand
- Tracks played notes to prevent retriggering
- Supports mute/unmute
- Volume control (0-1)

### 2. Sound Presets
Six different sound presets to choose from:

| Preset | Description | Sound | Lane Notes |
|--------|-------------|-------|------------|
| **Guitar** | Guitar-like strings | Sawtooth | E2, A2, D3, G3, B3 (like guitar strings) |
| **Synth Lead** | Square wave synth | Square | C, E, G, B, D (pentatonic) |
| **Bells** | Bell-like tones | Triangle | C4, E4, G4, C5, E5 (major chord) |
| **Retro Game** | 8-bit style | Square | C, D, E, G, A (major pentatonic) |
| **Piano** | General MIDI piano | GM Piano | C, E, G, B, D |
| **Bass** | Low bass notes | Sawtooth | E1, G1, A1, C2, D2 (low notes) |

Each preset has tuned:
- Decay (how quickly the sound fades)
- Sustain (held note level)
- Gain (volume)

### 3. Note Triggering
- **Hit notes** (< 100ms): Play as instant hits
- **Sustained notes** (> 100ms): Play with sustain matching the note length
- Notes trigger when they reach the strikeline hit window (±80ms)
- Prevents duplicate triggers per note

### 4. UI Components

#### AudioControls (`src/components/AudioControls.tsx`)
- Preset selector buttons
- Mute/unmute toggle with volume icon
- Shows currently playing preset
- Disabled during playback

#### Integration with ChartHighway
- Added `audioEnabled` prop to control audio
- Initializes audio manager on mount
- Clears played notes on stop/replay
- Syncs with audio manager mute state

### 5. Lane-to-Note Mapping
Each lane (0-4) maps to different pitches per preset:
- Lane 0: Green (lowest note)
- Lane 1: Red
- Lane 2: Yellow
- Lane 3: Blue
- Lane 4: Orange (highest note)

## Usage

The audio system automatically plays when:
1. Chart is playing
2. Audio is not muted
3. Notes hit the strikeline

Players can:
- Choose from 6 sound presets
- Mute/unmute anytime
- Change presets between plays

## Technical Details

### Dependencies
- `@strudel/web`: ^1.x (Tidal Cycles pattern language for JavaScript)

### Type Safety
- Created custom type declarations for `@strudel/web`
- Fully typed audio manager API

### Performance
- Notes only trigger once (tracked by Set)
- Audio context initialized on-demand
- Minimal overhead during rendering

## Future Enhancements
- Volume slider
- Custom pitch mappings
- Additional sound banks
- Audio effects (reverb, delay, etc.)
- MIDI output support
