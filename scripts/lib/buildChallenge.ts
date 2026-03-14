/**
 * Shared logic for generating a DailyChallenge object from a schedule entry.
 * Used by both generate-daily.ts and generate-archive.ts.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { parseChart } from "../parser/chartParser.ts";
import { parseMidi, parseSongIni } from "../parser/midiParser.ts";
import { normalize, sliceClip } from "../parser/normalizer.ts";
import type { DailyChallenge, TrackName } from "../../src/types.ts";

export const EPOCH = new Date("2026-03-10").getTime();

export interface ScheduleEntry {
  date: string;
  chartFile: string;
  track: string;
  startMs: number;
  title: string;
  artist: string;
  hints: string[];
  aliases?: string[];
  game?: string;
}

export function getChallengeNumber(date: string): number {
  return Math.floor((new Date(date).getTime() - EPOCH) / 86_400_000) + 1;
}

function tryLoadSongIni(dir: string): { title?: string; artist?: string } | undefined {
  const iniPath = join(dir, "song.ini");
  if (existsSync(iniPath)) {
    const ini = parseSongIni(readFileSync(iniPath, "utf8"));
    return { title: ini.title, artist: ini.artist };
  }
  return undefined;
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return ["(could not read directory)"];
  }
}

export function loadChart(path: string, track: TrackName) {
  if (path.endsWith(".chart")) {
    return parseChart(readFileSync(path, "utf8"), track);
  }
  if (path.endsWith(".mid")) {
    const buffer = readFileSync(path);
    const meta = tryLoadSongIni(dirname(path));
    return parseMidi(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      track,
      meta,
    );
  }

  const chartPath = join(path, "notes.chart");
  if (existsSync(chartPath)) {
    return parseChart(readFileSync(chartPath, "utf8"), track);
  }

  const midPath = join(path, "notes.mid");
  if (existsSync(midPath)) {
    const buffer = readFileSync(midPath);
    const meta = tryLoadSongIni(path);
    return parseMidi(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      track,
      meta,
    );
  }

  throw new Error(
    `No notes.chart or notes.mid found in "${path}". ` +
      `Available files: ${readdirSafe(path).join(", ")}`,
  );
}

/** Build a DailyChallenge from a schedule entry. nextChallengeAt is NOT set here. */
export function buildChallenge(entry: ScheduleEntry): DailyChallenge {
  const track = entry.track as TrackName;
  const raw = loadChart(entry.chartFile, track);
  const parsed = normalize(raw, track);
  const clip = sliceClip(parsed, entry.startMs);
  const answer = `${entry.title}|${entry.artist}`;

  return {
    date: entry.date,
    challengeNumber: getChallengeNumber(entry.date),
    clip,
    clipSongStartMs: entry.startMs,
    answerObfuscated: Buffer.from(answer).toString("base64"),
    aliasesObfuscated: (entry.aliases ?? []).map((a) =>
      Buffer.from(a).toString("base64"),
    ),
    hints: entry.hints,
    maxGuesses: 6,
    game: entry.game,
  };
}
