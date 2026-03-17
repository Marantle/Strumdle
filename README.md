# Strumdle

A daily Guitar Hero guessing game. Watch a note chart scroll down the screen and guess which song it is. Built with React, TypeScript, and Vite.

**Play at [strumdle.com](https://strumdle.com)**

Fallback URL: [strumdle.pages.dev](https://strumdle.pages.dev)

## How It Works

Each day a new 7-second clip from a Guitar Hero chart is revealed. You get 6 guesses, and the clip extends by 2 seconds with each wrong guess. Match hints (artist, game) help narrow it down.

## Development

No private data needed — a test chart is included:

```bash
npm install
npm run dev:setup   # generate test puzzle data
npm run dev          # start dev server
```

### With real song data

If you have access to the private data repo:

```bash
git submodule update --init                           # pull private data
npm run generate -- --date=2026-03-11                  # generate today's puzzle
npm run dev
```

The `data/` directory is a git submodule pointing to a private repo containing the song charts and schedule.

## Project Structure

- `src/` — React frontend (chart renderer, game logic, UI)
- `functions/api/` — Cloudflare Pages Functions API endpoints (`/api/visitorstats`, `/api/analytics`)
- `scripts/` — Build-time tools (puzzle generator, schedule builder, song importer)
- `data/` — Private submodule: songs, schedule, guitar sound sources
- `public/sounds/` — Guitar audio samples (open-licensed from freesound.org)

## API Endpoints

- `POST /api/analytics` — record a game completion (IP-deduped, writes to Analytics Engine)
- `GET /api/analytics?date=YYYY-MM-DD` — query Analytics Engine and return `{ date, plays, solves, archivePlays, firstTimers, attempts }`
- `GET /api/visitorstats` — internal-only daily play counts (last 30 days)

Examples:

- [https://strumdle.com/api/analytics?date=2026-03-12](https://strumdle.com/api/analytics?date=2026-03-12)

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run dev:setup` | Generate test puzzle data (no private data needed) |
| `npm run build` | Type-check and build for production |
| `npm run generate` | Generate today's puzzle from schedule |
| `npm run generate -- --date=YYYY-MM-DD` | Generate puzzle for a specific date |
| `npm run schedule` | Add 10 random songs to the schedule |
| `npm run schedule:curated` | Build the curated launch schedule |
| `npm run reschedule` | Shift schedule dates so first entry starts today |
| `npm run import-songs` | Import songs from `original_songs/` into `data/songs/` |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Adding Songs

Songs are imported from a local `original_songs/` directory (gitignored) using `npm run import-songs`. The importer expects Guitar Hero chart folders — each containing at minimum a `notes.mid` file, and optionally a `song.ini` metadata file.

### Supported games

The importer scans these subdirectories of `original_songs/` by name:

| Directory | Game |
|-----------|------|
| `Guitar Hero` | Guitar Hero (GH1) |
| `Guitar Hero II` | Guitar Hero II |
| `Guitar Hero III` | Guitar Hero III: Legends of Rock |
| `Guitar Hero - Aerosmith` | Guitar Hero: Aerosmith |
| `Guitar Hero - Metallica` | Guitar Hero: Metallica |
| `Guitar Hero World Tour` | Guitar Hero: World Tour |
| `Guitar Hero 5` | Guitar Hero 5 |

### Source format

Charts must follow the standard Clone Hero / Guitar Hero rip format:

```
original_songs/
  Guitar Hero II/
    Quickplay/
      Nirvana - Heart-Shaped Box/
        notes.mid
        song.ini
    Bonus/
      Some Band - Some Song/
        notes.mid
        song.ini
```

Songs found inside a `Bonus/` subdirectory are marked as bonus tracks and excluded from random schedule generation (but still importable and usable if added manually to `schedule.json`).

Both `notes.mid` (MIDI binary) and `notes.chart` (text format) are supported. When `chartFile` in `schedule.json` points to a directory, `notes.chart` is tried first, then `notes.mid`. You can also point `chartFile` directly at a `.chart` or `.mid` file path to bypass the directory lookup entirely.

Co-op variants (songs with `(Co-op)` in their name) and guitar battle tracks are automatically skipped.

### Where to get charts

Guitar Hero chart rips are widely available in the Clone Hero community. The [ScoreHero](https://www.scorehero.com) forums and the Clone Hero Discord are common starting points. You need the original MIDI-based rips, not `.chart` format.

### Symlinking a song library

If your charts live on a different drive, you can symlink them:

```
# Windows (run as Administrator in cmd.exe)
mklink /D "original_songs" "E:\Guitar Hero Charts"
```

## Deployment

The private repo runs a nightly GitHub Action that generates the day's puzzle, builds the app, and deploys to Cloudflare Pages.

To deploy manually:

```bash
npm run deploy
```

Cloudflare configuration used by this app:

- `ANALYTICS` Analytics Engine dataset binding (`strumdle`)
- Pages environment variable: `CF_ACCOUNT_ID` (used by `/api/analytics`)
- Pages secret: `CF_API_TOKEN` (used by `/api/analytics`)
- Pages secret: `IP_HASH_SALT` (used by `/api/analytics` for first-timer detection)

Note: set secrets in the Cloudflare Pages dashboard (Environment Variables), not in source control.

## PWA And SEO

- PWA is enabled via `vite-plugin-pwa` with generated service worker + manifest.
- Install prompt is available in supported Chromium browsers when `beforeinstallprompt` fires.
- SEO crawl files are served from:
	- [public/robots.txt](public/robots.txt)
	- [public/sitemap.xml](public/sitemap.xml)

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Hosting**: Cloudflare Pages (free tier)
- **Charts**: Parsed from Guitar Hero MIDI files
