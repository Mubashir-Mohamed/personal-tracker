# Personal Tracker

A personal monitoring/planning desktop app that runs all day in the menu bar. Built one module at a time with Electron, React, and TypeScript, all data stored locally in SQLite — nothing leaves your machine except a live weather lookup (see [Data](#data)).

## Modules

### Home

The landing page, styled as a phosphor-terminal dashboard:

- **Boot bar** — live clock, time-of-day greeting, today's date, and current Kochi weather (fetched from Open-Meteo, no API key required).
- **Job hunt pipeline** — reads the "daily-job-listing" Claude routine's already-archived snapshots directly (see Claude Runners below, no separate import step): scanned / strong-fit / new-since-last-run counts, the single **best-scoring match across every archived run to date**, the current run's top matches with score bars, city and source breakdowns, and the ".NET auto-filtered" note lifted straight from the report.
- **Interview prep plan** — a 4-week study plan with each week's topics as bullet points, the current week highlighted, and a study streak with a "mark today studied" button.
- **Todos** and **Quick links** — small CRUD lists (add/toggle/delete), both backed by SQLite.

### Time Management

Daily routine planning and tracking:

- **Today** — a live timeline of today's schedule (weekday job hours + lunch break + job hunt + family time, or the weekend split), with a day-progress strip, a spotlight card for what's happening now, and mark done / skip / delay controls.
- **Stats** — weekly hours per category, job-hunt and family-time streaks, applications logged, adherence.
- **Settings** — edit the recurring weekday/weekend schedule, notification lead time, and login auto-launch.

Native macOS notifications (with a distinct sound per category) fire before and at the start/end of each block. The app lives in the menu bar tray — closing the window just hides it, the tray keeps everything running in the background.

### Claude Runners

Tracks recurring Claude Code routines (set up via the `/schedule` skill):

- Routines are auto-discovered from `~/.claude/scheduled-tasks/*/SKILL.md` — real name, description, and prompt, no API needed.
- Link a routine to the output file it overwrites each run (via a native file picker). The app polls every 5 minutes, and whenever that file changes it archives a dated snapshot and parses it.
- Each day's snapshot is browsable as a real table (not an embedded spreadsheet) — sheets render as tabs, with a "Reveal original file" button for the raw file.

## Tech stack

Electron + React + TypeScript, scaffolded with `electron-vite`. `better-sqlite3` for storage, `exceljs` for reading workbook snapshots, `recharts` for charts, `date-fns` for date handling, `auto-launch` for the login item. The Home dashboard's weather chip calls the Open-Meteo REST API directly from the main process (`fetch`, no SDK).

## Project setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

The production build is unsigned (no Apple Developer certificate configured) — on macOS, right-click the built app and choose **Open** the first time to get past Gatekeeper.

## Data

Everything is stored locally under Electron's `userData` path (`~/Library/Application Support/personal-tracker` on macOS): the SQLite database and archived routine snapshots. Nothing is synced anywhere.

The one exception is the Home dashboard's weather chip, which calls the public Open-Meteo API every 30 minutes with a fixed Kochi latitude/longitude — no account, key, or personal data involved.
