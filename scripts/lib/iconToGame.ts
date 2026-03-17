// Maps song.ini `icon` field to display game name.
// IMPORTANT: if you add a new game to import-songs.ts, add its icon here too
// or songs will show as "Unknown" in the song list and hints.
// Known icons: gh1, gh2, gh3, gha, ghm, gh5, ghwt
export const ICON_TO_GAME: Record<string, string> = {
  gh1: "Guitar Hero",
  gh2: "Guitar Hero II",
  gh3: "Guitar Hero III",
  gha: "Guitar Hero: Aerosmith",
  ghm: "Guitar Hero: Metallica",
  gh5: "Guitar Hero 5",
  ghwt: "Guitar Hero: World Tour",
};
