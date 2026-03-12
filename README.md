# Strumdle

A daily Guitar Hero guessing game. Watch a note chart scroll down the screen and guess which song it is. Built with React, TypeScript, and Vite.

**Play at [strumdle.pages.dev](https://strumdle.pages.dev)**

## How It Works

Each day a new 5-second clip from a Guitar Hero chart is revealed. You get 6 guesses, and the clip extends by 2 seconds with each wrong guess. Match hints (artist, game) help narrow it down.

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
- `scripts/` — Build-time tools (puzzle generator, schedule builder, song importer)
- `data/` — Private submodule: songs, schedule, guitar sound sources
- `public/sounds/` — Guitar audio samples (open-licensed from freesound.org)

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

## Deployment

The private repo runs a nightly GitHub Action that generates the day's puzzle, builds the app, and deploys to Cloudflare Pages.

To deploy manually:

```bash
npm run deploy
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Hosting**: Cloudflare Pages (free tier)
- **Charts**: Parsed from Guitar Hero MIDI files
