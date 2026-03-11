import { normalizeTitle } from "./normalize";
import type { DailyChallenge, SongListEntry } from "../../types";

export interface GuessResult {
  correct: boolean;
  artistMatch: boolean;
  gameMatch: boolean;
}

/**
 * Check if a guess (always a song title from the list) matches the answer.
 * Returns enriched result with artist/game match info.
 */
export function checkGuess(
  rawGuess: string,
  challenge: DailyChallenge,
  songList: SongListEntry[],
): GuessResult {
  const normalized = normalizeTitle(rawGuess);

  // Decode obfuscated answer and aliases at match time
  const decoded = atob(challenge.answerObfuscated);
  const [answerTitle, answerArtist] = decoded.split("|");
  const answerGame = challenge.game ?? "";
  const aliases = challenge.aliasesObfuscated.map((a) => atob(a));
  const candidates = [answerTitle, ...aliases].map(normalizeTitle);

  const correct = candidates.includes(normalized);

  // Find guessed song in songList for metadata
  const guessedEntry = songList.find(
    (s) => normalizeTitle(s.title) === normalized,
  );

  const artistMatch = guessedEntry
    ? normalizeTitle(guessedEntry.artist) === normalizeTitle(answerArtist)
    : false;

  const gameMatch = guessedEntry
    ? guessedEntry.game === answerGame
    : false;

  return { correct, artistMatch, gameMatch };
}

/**
 * Decode the obfuscated answer for display after game ends.
 */
export function revealAnswer(
  challenge: DailyChallenge,
): { title: string; artist: string } {
  const decoded = atob(challenge.answerObfuscated);
  const [title, artist] = decoded.split("|");
  return { title, artist };
}
