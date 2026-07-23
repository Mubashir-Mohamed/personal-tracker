# Personal Tracker

A personal monitoring/planning desktop app that runs all day in the menu bar. Built one module at a time with Electron, React, and TypeScript, all data stored locally in SQLite — nothing leaves your machine.

## Modules

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

Electron + React + TypeScript, scaffolded with `electron-vite`. `better-sqlite3` for storage, `exceljs` for reading workbook snapshots, `recharts` for charts, `date-fns` for date handling, `auto-launch` for the login item.

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
