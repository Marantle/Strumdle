import type { NoteEvent } from "../../types";
import type { RendererState, RendererConfig } from "./types";
import {
  DEFAULT_CONFIG,
  LANE_COLORS,
} from "./types";
import { audioManager } from "../audio/audioManager";

// ---------------------------------------------------------------------------
// Perspective helpers
// ---------------------------------------------------------------------------

function perspectiveAtRawY(
  rawY: number,
  config: RendererConfig,
): { screenY: number; scale: number } {
  if (rawY <= 0) {
    return { screenY: config.strikelineY, scale: 1.0 };
  }

  const totalTravel = config.strikelineY - config.topY;
  const clamped = Math.min(rawY, totalTravel);
  const t = clamped / totalTravel;

  const power = 2.2;
  const perspT = 1.0 - Math.pow(1.0 - t, power);

  const screenY = config.strikelineY - perspT * totalTravel;
  const scale = 1.0 - perspT * (1.0 - config.topScale);

  return { screenY, scale };
}

function laneCenter(
  lane: number,
  scale: number,
  config: RendererConfig,
): number {
  const cx = config.canvasWidth / 2;
  const scaledWidth = config.highwayWidth * scale;
  const laneW = scaledWidth / 5;
  const leftEdge = cx - scaledWidth / 2;
  return leftEdge + laneW * (lane + 0.5);
}

function highwayLeft(scale: number, config: RendererConfig): number {
  return (config.canvasWidth - config.highwayWidth * scale) / 2;
}

function highwayRight(scale: number, config: RendererConfig): number {
  return (config.canvasWidth + config.highwayWidth * scale) / 2;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
}

function hexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Drawing functions
// ---------------------------------------------------------------------------

function drawHighwayBackground(
  ctx: CanvasRenderingContext2D,
  config: RendererConfig,
): void {
  const { canvasWidth, canvasHeight, strikelineY, topY, topScale } = config;

  // Full canvas dark background
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Highway trapezoid
  const topLeft = highwayLeft(topScale, config);
  const topRight = highwayRight(topScale, config);
  const botLeft = highwayLeft(1, config);
  const botRight = highwayRight(1, config);

  // Dark highway surface with gradient
  const gradient = ctx.createLinearGradient(0, topY, 0, strikelineY);
  gradient.addColorStop(0, "#08080f");
  gradient.addColorStop(0.5, "#0e0e1a");
  gradient.addColorStop(1, "#121222");
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(topLeft, topY);
  ctx.lineTo(topRight, topY);
  ctx.lineTo(botRight, strikelineY);
  ctx.lineTo(botLeft, strikelineY);
  ctx.closePath();
  ctx.fill();

  // Highway edge rails: metallic look
  ctx.lineWidth = 2.5;
  const railGrad = ctx.createLinearGradient(0, topY, 0, strikelineY);
  railGrad.addColorStop(0, "rgba(120, 120, 140, 0.3)");
  railGrad.addColorStop(0.5, "rgba(180, 180, 200, 0.5)");
  railGrad.addColorStop(1, "rgba(200, 200, 220, 0.6)");
  ctx.strokeStyle = railGrad;

  ctx.beginPath();
  ctx.moveTo(topLeft, topY);
  ctx.lineTo(botLeft, strikelineY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(topRight, topY);
  ctx.lineTo(botRight, strikelineY);
  ctx.stroke();

  // Lane separator "strings": metallic wires
  for (let i = 1; i < 5; i++) {
    const topX = laneCenter(i - 0.5, topScale, config);
    const botX = laneCenter(i - 0.5, 1, config);

    // Thin bright core
    ctx.strokeStyle = "rgba(160, 160, 180, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, strikelineY);
    ctx.stroke();

    // Wider dim glow around it
    ctx.strokeStyle = "rgba(100, 100, 130, 0.08)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, strikelineY);
    ctx.stroke();
  }
}

function drawBeatLines(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  config: RendererConfig,
): void {
  const beatIntervalMs = 500;
  const lookaheadMs = (config.strikelineY - config.topY) / config.scrollSpeed;

  const firstBeat = Math.floor((elapsed - 200) / beatIntervalMs) * beatIntervalMs;
  const lastBeat = elapsed + lookaheadMs + 100;

  for (let beatMs = firstBeat; beatMs <= lastBeat; beatMs += beatIntervalMs) {
    const distanceMs = beatMs - elapsed;
    if (distanceMs < -50) continue;

    const rawY = distanceMs * config.scrollSpeed;
    const { screenY, scale } = perspectiveAtRawY(rawY, config);

    if (screenY < config.topY || screenY > config.strikelineY) continue;

    const left = highwayLeft(scale, config);
    const right = highwayRight(scale, config);

    // Metallic fret wire look
    ctx.strokeStyle = "rgba(150, 150, 170, 0.12)";
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(left, screenY);
    ctx.lineTo(right, screenY);
    ctx.stroke();

    // Subtle highlight on top edge
    ctx.strokeStyle = "rgba(200, 200, 220, 0.06)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(left, screenY - 0.5);
    ctx.lineTo(right, screenY - 0.5);
    ctx.stroke();
  }
}

/**
 * Draw a 3D puck-shaped note gem.
 * Looks like a cylindrical button with a highlight cap on top.
 */
function drawNote(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  screenY: number,
  scale: number,
  color: string,
  config: RendererConfig,
): void {
  const laneW = (config.highwayWidth * scale) / 5;
  const noteW = laneW * 0.7;
  const rx = noteW / 2; // horizontal radius of ellipse
  const ry = Math.max(3, 7 * scale); // vertical radius (squashed for perspective)
  const puckHeight = Math.max(2, 5 * scale); // 3D depth of the puck

  const [cr, cg, cb] = hexToRgb(color);

  // --- Puck side (the 3D depth) ---
  // Draw a filled region between two ellipses offset vertically
  ctx.beginPath();
  // Bottom half of the lower ellipse (front face)
  ctx.ellipse(centerX, screenY + puckHeight, rx, ry, 0, 0, Math.PI);
  // Top half of the upper ellipse (going back), reversed
  ctx.ellipse(centerX, screenY, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();

  const sideGrad = ctx.createLinearGradient(centerX - rx, 0, centerX + rx, 0);
  sideGrad.addColorStop(0, darken(color, 60));
  sideGrad.addColorStop(0.5, darken(color, 20));
  sideGrad.addColorStop(1, darken(color, 60));
  ctx.fillStyle = sideGrad;
  ctx.fill();

  // --- Top cap (the main visible face) ---
  ctx.beginPath();
  ctx.ellipse(centerX, screenY, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();

  const capGrad = ctx.createRadialGradient(
    centerX - rx * 0.2, screenY - ry * 0.3, rx * 0.1,
    centerX, screenY, rx,
  );
  capGrad.addColorStop(0, lighten(color, 80));
  capGrad.addColorStop(0.4, color);
  capGrad.addColorStop(0.8, darken(color, 20));
  capGrad.addColorStop(1, darken(color, 50));
  ctx.fillStyle = capGrad;
  ctx.fill();

  // Cap border
  ctx.strokeStyle = `rgba(${Math.min(255, cr + 40)}, ${Math.min(255, cg + 40)}, ${Math.min(255, cb + 40)}, 0.6)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Specular highlight on top ---
  ctx.beginPath();
  ctx.ellipse(centerX, screenY - ry * 0.15, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.closePath();
  const specGrad = ctx.createRadialGradient(
    centerX, screenY - ry * 0.2, 0,
    centerX, screenY - ry * 0.15, rx * 0.55,
  );
  specGrad.addColorStop(0, `rgba(255, 255, 255, ${0.5 * scale})`);
  specGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
  ctx.fillStyle = specGrad;
  ctx.fill();
}

/**
 * Draw a glowing sustain tail with perspective.
 */
function drawSustain(
  ctx: CanvasRenderingContext2D,
  note: NoteEvent,
  elapsed: number,
  config: RendererConfig,
): void {
  const color = LANE_COLORS[note.lane];
  const [cr, cg, cb] = hexToRgb(color);
  const steps = 24;
  const totalMs = note.lengthMs;

  // Draw outer glow pass first
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * totalMs;
    const t1 = ((i + 1) / steps) * totalMs;

    const dist0 = (note.timeMs + t0) - elapsed;
    const dist1 = (note.timeMs + t1) - elapsed;

    const rawY0 = dist0 * config.scrollSpeed;
    const rawY1 = dist1 * config.scrollSpeed;

    const p0 = perspectiveAtRawY(rawY0, config);
    const p1 = perspectiveAtRawY(rawY1, config);

    if (p0.screenY < config.topY && p1.screenY < config.topY) continue;

    const cx0 = laneCenter(note.lane, p0.scale, config);
    const cx1 = laneCenter(note.lane, p1.scale, config);
    const glowW0 = (config.highwayWidth * p0.scale / 5) * 0.35;
    const glowW1 = (config.highwayWidth * p1.scale / 5) * 0.35;

    // Outer glow
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, 0.15)`;
    ctx.beginPath();
    ctx.moveTo(cx0 - glowW0, p0.screenY);
    ctx.lineTo(cx0 + glowW0, p0.screenY);
    ctx.lineTo(cx1 + glowW1, p1.screenY);
    ctx.lineTo(cx1 - glowW1, p1.screenY);
    ctx.closePath();
    ctx.fill();
  }

  // Inner bright core
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * totalMs;
    const t1 = ((i + 1) / steps) * totalMs;

    const dist0 = (note.timeMs + t0) - elapsed;
    const dist1 = (note.timeMs + t1) - elapsed;

    const rawY0 = dist0 * config.scrollSpeed;
    const rawY1 = dist1 * config.scrollSpeed;

    const p0 = perspectiveAtRawY(rawY0, config);
    const p1 = perspectiveAtRawY(rawY1, config);

    if (p0.screenY < config.topY && p1.screenY < config.topY) continue;

    const cx0 = laneCenter(note.lane, p0.scale, config);
    const cx1 = laneCenter(note.lane, p1.scale, config);
    const w0 = (config.highwayWidth * p0.scale / 5) * 0.12;
    const w1 = (config.highwayWidth * p1.scale / 5) * 0.12;

    // Bright core
    ctx.fillStyle = `rgba(${Math.min(255, cr + 60)}, ${Math.min(255, cg + 60)}, ${Math.min(255, cb + 60)}, 0.8)`;
    ctx.beginPath();
    ctx.moveTo(cx0 - w0, p0.screenY);
    ctx.lineTo(cx0 + w0, p0.screenY);
    ctx.lineTo(cx1 + w1, p1.screenY);
    ctx.lineTo(cx1 - w1, p1.screenY);
    ctx.closePath();
    ctx.fill();

    // White-hot center line
    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
    const cw0 = w0 * 0.3;
    const cw1 = w1 * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx0 - cw0, p0.screenY);
    ctx.lineTo(cx0 + cw0, p0.screenY);
    ctx.lineTo(cx1 + cw1, p1.screenY);
    ctx.lineTo(cx1 - cw1, p1.screenY);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw the fret buttons at the strikeline.
 * Guitar Hero style: colored ring with inner dark circle and arrow icon.
 */
function drawFretButtons(
  ctx: CanvasRenderingContext2D,
  activeNotes: Set<number>,
  config: RendererConfig,
): void {
  const { strikelineY, fretRadius } = config;
  const y = strikelineY;

  // Strikeline bar behind the buttons
  const left = highwayLeft(1, config);
  const right = highwayRight(1, config);
  ctx.strokeStyle = "rgba(200, 200, 220, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  for (let lane = 0; lane < 5; lane++) {
    const cx = laneCenter(lane, 1, config);
    const isActive = activeNotes.has(lane);
    const color = LANE_COLORS[lane];
    const [cr, cg, cb] = hexToRgb(color);

    // Outer glow when active
    if (isActive) {
      const glowGrad = ctx.createRadialGradient(
        cx, y, fretRadius * 0.3,
        cx, y, fretRadius * 3,
      );
      glowGrad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.4)`);
      glowGrad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, 0.1)`);
      glowGrad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, y, fretRadius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer colored ring
    ctx.beginPath();
    ctx.arc(cx, y, fretRadius, 0, Math.PI * 2);
    if (isActive) {
      ctx.fillStyle = color;
    } else {
      ctx.fillStyle = hexAlpha(color, 0.35);
    }
    ctx.fill();

    // Inner dark circle
    const innerR = fretRadius * 0.7;
    ctx.beginPath();
    ctx.arc(cx, y, innerR, 0, Math.PI * 2);
    if (isActive) {
      // Lit: filled with lighter color
      const innerGrad = ctx.createRadialGradient(
        cx, y - innerR * 0.3, innerR * 0.1,
        cx, y, innerR,
      );
      innerGrad.addColorStop(0, lighten(color, 60));
      innerGrad.addColorStop(0.6, color);
      innerGrad.addColorStop(1, darken(color, 30));
      ctx.fillStyle = innerGrad;
    } else {
      // Dark interior
      const innerGrad = ctx.createRadialGradient(
        cx, y - innerR * 0.2, innerR * 0.1,
        cx, y, innerR,
      );
      innerGrad.addColorStop(0, "#1a1a2a");
      innerGrad.addColorStop(1, "#0a0a15");
      ctx.fillStyle = innerGrad;
    }
    ctx.fill();

    // Outer ring border
    ctx.beginPath();
    ctx.arc(cx, y, fretRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isActive
      ? lighten(color, 40)
      : `rgba(${cr}, ${cg}, ${cb}, 0.4)`;
    ctx.lineWidth = isActive ? 2 : 1.5;
    ctx.stroke();

    // Arrow/chevron icon inside
    const arrowSize = fretRadius * 0.3;
    const arrowY = y;
    ctx.strokeStyle = isActive
      ? "rgba(255, 255, 255, 0.9)"
      : `rgba(${cr}, ${cg}, ${cb}, 0.4)`;
    ctx.lineWidth = isActive ? 2 : 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    // Downward chevron ▼
    ctx.moveTo(cx - arrowSize, arrowY - arrowSize * 0.5);
    ctx.lineTo(cx, arrowY + arrowSize * 0.5);
    ctx.lineTo(cx + arrowSize, arrowY - arrowSize * 0.5);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export function render(
  ctx: CanvasRenderingContext2D,
  state: RendererState,
  now: number,
  config: RendererConfig = DEFAULT_CONFIG,
): boolean {
  const lookaheadMs = (config.strikelineY - config.topY) / config.scrollSpeed;
  const elapsed = now - (state.startTime ?? now);

  // Clear
  ctx.clearRect(0, 0, config.canvasWidth, config.canvasHeight);

  // Highway background
  drawHighwayBackground(ctx, config);

  // Beat lines (scrolling)
  drawBeatLines(ctx, elapsed, config);

  // Determine which lanes have a note at the strikeline (for button glow)
  const activeNotes = new Set<number>();
  const hitWindow = 80;

  // Draw sustains first (behind notes)
  for (const note of state.notes) {
    const distanceMs = note.timeMs - elapsed;
    const tailDistanceMs = (note.timeMs + note.lengthMs) - elapsed;

    // Audio triggering: when note hits the strikeline
    if (state.audioEnabled && Math.abs(distanceMs) < hitWindow) {
      const noteKey = `${note.lane}-${note.timeMs}`;
      if (!state.playedNotes.has(noteKey)) {
        state.playedNotes.add(noteKey);
        
        // Trigger audio based on note type
        if (note.lengthMs > 100) {
          // Sustained note
          audioManager.playSustainedNote(note.lane, note.lengthMs);
        } else {
          // Quick hit
          audioManager.playNoteHit(note.lane);
        }
      }
    }

    if (Math.abs(distanceMs) < hitWindow) {
      activeNotes.add(note.lane);
    }

    if (note.lengthMs > 0 && distanceMs < 0 && tailDistanceMs > -hitWindow) {
      activeNotes.add(note.lane);
    }

    if (note.lengthMs > 0) {
      if (tailDistanceMs < -200 || distanceMs > lookaheadMs + 500) continue;
      drawSustain(ctx, note, elapsed, config);
    }
  }

  // Draw note gems
  for (const note of state.notes) {
    const distanceMs = note.timeMs - elapsed;
    if (distanceMs < -200 || distanceMs > lookaheadMs + 100) continue;

    const rawY = distanceMs * config.scrollSpeed;
    const { screenY, scale } = perspectiveAtRawY(rawY, config);

    if (screenY < config.topY - 10 || screenY > config.strikelineY + 30) continue;

    const cx = laneCenter(note.lane, scale, config);
    const color = LANE_COLORS[note.lane];

    drawNote(ctx, cx, screenY, scale, color, config);
  }

  // Fret buttons on top of everything
  drawFretButtons(ctx, activeNotes, config);

  // Clip duration badge
  drawClipBadge(ctx, config, state.clipDurationMs);

  // Running song position badge
  drawSongPositionBadge(ctx, config, state.songStartMs + elapsed);

  return elapsed < state.clipDurationMs;
}

/**
 * Draw a clip duration badge in the top-left corner of the highway.
 */
function drawClipBadge(
  ctx: CanvasRenderingContext2D,
  config: RendererConfig,
  clipDurationMs: number,
): void {
  const seconds = Math.round(clipDurationMs / 1000);
  const text = `${seconds}s CLIP`;
  const px = 12;
  const py = config.topY + 16;
  const padX = 8;
  const padY = 4;

  ctx.font = "bold 11px system-ui, sans-serif";
  const metrics = ctx.measureText(text);
  const w = metrics.width + padX * 2;
  const h = 16 + padY * 2;

  // Background pill
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  const r = 4;
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + w - r, py);
  ctx.quadraticCurveTo(px + w, py, px + w, py + r);
  ctx.lineTo(px + w, py + h - r);
  ctx.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
  ctx.lineTo(px + r, py + h);
  ctx.quadraticCurveTo(px, py + h, px, py + h - r);
  ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, px + padX, py + h / 2);
}

function formatSongPosition(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Draw the running absolute song position in the top-right corner.
 */
function drawSongPositionBadge(
  ctx: CanvasRenderingContext2D,
  config: RendererConfig,
  songPositionMs: number,
): void {
  const text = formatSongPosition(songPositionMs);
  const padX = 8;
  const padY = 4;

  ctx.font = "bold 11px system-ui, sans-serif";
  const metrics = ctx.measureText(text);
  const w = metrics.width + padX * 2;
  const h = 16 + padY * 2;

  const py = config.topY + 16;
  const px = config.canvasWidth - w - 12;
  const r = 4;

  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + w - r, py);
  ctx.quadraticCurveTo(px + w, py, px + w, py + r);
  ctx.lineTo(px + w, py + h - r);
  ctx.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
  ctx.lineTo(px + r, py + h);
  ctx.quadraticCurveTo(px, py + h, px, py + h - r);
  ctx.lineTo(px, py + r);
  ctx.quadraticCurveTo(px, py, px + r, py);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, px + padX, py + h / 2);
}
