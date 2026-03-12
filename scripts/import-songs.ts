/**
 * One-time script: imports songs from original_songs/ into songs/
 * Copies only notes.mid and song.ini (no audio files).
 *
 * Usage: npm run import-songs
 */

import { readdirSync, existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from "fs";
import { join, basename } from "path";
import { parseSongIni } from "./parser/midiParser.ts";

const SOURCE_DIR = "original_songs";
const TARGET_DIR = "data/songs";

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
        // Recurse into subdirectories
        results.push(...findSongDirs(full));
      }
    } catch {
      // skip
    }
  }
  return results;
}

// Track used slugs to handle collisions
const usedSlugs = new Set<string>();

// Track already-imported song titles (normalized) to skip duplicates
const importedTitles = new Set<string>();

// Pre-populate from existing songs/ dirs
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

// Main
const songDirs = findSongDirs(SOURCE_DIR);
console.log(`Found ${songDirs.length} songs in ${SOURCE_DIR}/\n`);

let imported = 0;
let skipped = 0;
let errors = 0;

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

  // Skip if this song title is already imported
  if (importedTitles.has(songName.toLowerCase())) {
    skipped++;
    continue;
  }

  const slug = getUniqueSlug(songName);
  const destDir = join(TARGET_DIR, slug);

  try {
    mkdirSync(destDir, { recursive: true });

    // Copy notes.mid
    copyFileSync(join(srcDir, "notes.mid"), join(destDir, "notes.mid"));

    // Copy song.ini if present
    if (existsSync(iniPath)) {
      copyFileSync(iniPath, join(destDir, "song.ini"));
    }

    importedTitles.add(songName.toLowerCase());
    imported++;
    console.log(`  ✓ ${songName} → songs/${slug}/`);
  } catch (e) {
    errors++;
    console.error(`  ✗ ${songName}: ${e}`);
  }
}

console.log(`\nDone: ${imported} imported, ${skipped} skipped, ${errors} errors`);
console.log(`Total songs in songs/: ${readdirSync(TARGET_DIR).length}`);
