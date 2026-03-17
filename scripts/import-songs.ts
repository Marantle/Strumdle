/**
 * Imports songs from original_songs/ into data/songs/
 * Copies only notes.mid and song.ini (no audio files).
 * Songs found in a "Bonus" subdirectory get an empty "bonus" marker file.
 *
 * Usage:
 *   npm run import-songs           # real import
 *   npm run import-songs -- --dry-run  # preview only
 */

import { readdirSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, basename } from "path";
import { parseSongIni } from "./parser/midiParser.ts";

const SOURCE_DIR = "original_songs";
const TARGET_DIR = "data/songs";

const DRY_RUN = process.argv.includes("--dry-run");

const GAME_DIRS = [
  "Guitar Hero",
  "Guitar Hero II",
  "Guitar Hero III",
  "Guitar Hero - Aerosmith",
  "Guitar Hero - Metallica",
  "Guitar Hero World Tour",
  "Guitar Hero 5",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

// Recursively find all directories containing notes.mid
function findSongDirs(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        if (existsSync(join(full, "notes.mid"))) {
          results.push(full);
        }
        results.push(...findSongDirs(full));
      }
    } catch {
      // skip
    }
  }
  return results;
}

function isBonus(srcPath: string): boolean {
  // Check if any path segment is exactly "Bonus" (case-insensitive)
  return srcPath.split(/[\\/]/).some(seg => seg.toLowerCase() === "bonus");
}

// Track used slugs to handle collisions
const usedSlugs = new Set<string>();

// Track already-imported song titles (normalized) to skip duplicates
const importedTitles = new Set<string>();

// Pre-populate from existing data/songs/ dirs
if (existsSync(TARGET_DIR)) {
  for (const d of readdirSync(TARGET_DIR)) {
    usedSlugs.add(d);
    const ini = join(TARGET_DIR, d, "song.ini");
    if (existsSync(ini)) {
      try {
        const parsed = parseSongIni(readFileSync(ini, "utf8"));
        importedTitles.add(parsed.title.toLowerCase());
      } catch { /* skip */ }
    }
  }
}

function getUniqueSlug(base: string): string {
  let slug = slugify(base);
  if (!usedSlugs.has(slug)) {
    usedSlugs.add(slug);
    return slug;
  }
  let i = 2;
  while (usedSlugs.has(`${slug}-${i}`)) i++;
  slug = `${slug}-${i}`;
  usedSlugs.add(slug);
  return slug;
}

if (DRY_RUN) console.log("DRY RUN — no files will be written\n");

let imported = 0;
let importedBonus = 0;
let skipped = 0;
let errors = 0;

for (const gameDir of GAME_DIRS) {
  const fullGameDir = join(SOURCE_DIR, gameDir);
  if (!existsSync(fullGameDir)) {
    console.warn(`  ⚠ Not found: ${fullGameDir}`);
    continue;
  }

  const songDirs = findSongDirs(fullGameDir);
  let gameCount = 0;
  console.log(`\n[${gameDir}]`);

  for (const srcDir of songDirs) {
    const iniPath = join(srcDir, "song.ini");
    let songName: string;

    if (existsSync(iniPath)) {
      try {
        const ini = parseSongIni(readFileSync(iniPath, "utf8"));
        songName = ini.title;
      } catch {
        songName = basename(srcDir);
      }
    } else {
      songName = basename(srcDir);
    }

    // Skip co-op variants
    if (/\(co-?op\)/i.test(songName)) {
      skipped++;
      continue;
    }

    // Skip guitar battle tracks
    if (/guitar battle/i.test(songName)) {
      skipped++;
      continue;
    }

    // Skip if already imported
    if (importedTitles.has(songName.toLowerCase())) {
      skipped++;
      continue;
    }

    const bonus = isBonus(srcDir);
    const slug = getUniqueSlug(songName);
    const destDir = join(TARGET_DIR, slug);
    const label = bonus ? " [bonus]" : "";

    if (DRY_RUN) {
      console.log(`  ✓ ${songName}${label} → songs/${slug}/`);
      importedTitles.add(songName.toLowerCase());
      imported++;
      gameCount++;
      if (bonus) importedBonus++;
      continue;
    }

    try {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(join(srcDir, "notes.mid"), join(destDir, "notes.mid"));
      if (existsSync(iniPath)) {
        copyFileSync(iniPath, join(destDir, "song.ini"));
      }
      if (bonus) {
        writeFileSync(join(destDir, "bonus"), "");
      }
      importedTitles.add(songName.toLowerCase());
      imported++;
      gameCount++;
      if (bonus) importedBonus++;
      console.log(`  ✓ ${songName}${label} → songs/${slug}/`);
    } catch (e) {
      errors++;
      console.error(`  ✗ ${songName}: ${e}`);
    }
  }

  console.log(`  → ${gameCount} songs imported`);
}

console.log(`\nDone: ${imported} imported (${importedBonus} bonus, ${imported - importedBonus} main setlist), ${skipped} skipped, ${errors} errors`);
if (!DRY_RUN) console.log(`Total songs in data/songs/: ${readdirSync(TARGET_DIR).length}`);
