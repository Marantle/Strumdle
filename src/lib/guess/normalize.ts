/**
 * Normalize a song title for comparison: lowercase, strip articles,
 * strip punctuation, collapse whitespace.
 */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize an artist name for comparison: strip trailing parentheticals
 * like "(WaveGroup)" or "(Steve Quimette)" before standard normalization.
 */
export function normalizeArtist(raw: string): string {
  return normalizeTitle(raw.replace(/\s*\(.*?\)\s*$/, ""));
}
