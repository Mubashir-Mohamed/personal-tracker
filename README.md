# Personal Tracker

A personal monitoring/planning desktop app that runs all day in the menu bar. Built one module at a time with Electron, React, and TypeScript, all data stored locally in SQLite — nothing leaves your machine except a live weather lookup (see [Data](#data)).

This is a **self-hosted, single-user app**: everyone who clones and runs it gets their own local install, their own local database, and their own schedule/categories/routines — there's no shared server, no accounts, and nothing that assumes it's talking to any one person's setup. Clone it, run it, and configure your own routine from a blank slate (see [First-run configuration](#first-run-configuration)).

## Modules

### Home

The landing page, styled as a phosphor-terminal dashboard:

- **Boot bar** — live clock, time-of-day greeting (with your name, if you've set one in Settings), today's date, and current weather for whatever location you've configured (defaults to Kochi, India — see [First-run configuration](#first-run-configuration)).
- **Job hunt pipeline** — reads whichever Claude routine you've picked in Settings as your job-hunt pipeline, straight from that routine's already-archived snapshots (see [Claude Runners](#claude-runners) below, no separate import step): scanned / strong-fit / new-since-last-run counts, the single **best-scoring match across every archived run to date**, the current run's top matches with score bars, and location/source breakdowns. Nothing is auto-detected by name — you choose the routine explicitly.
- **Interview prep plan** — a study plan with each week's topics as bullet points, the current week highlighted, and a study streak with a "mark today studied" button. Weeks ship with example starter content and are fully editable — add, edit, or delete weeks from the card's "Edit plan" toggle.
- **Todos** and **Quick links** — small CRUD lists (add/toggle/delete), both backed by SQLite.

### Time Management

Daily routine planning and tracking, built entirely from schedule blocks you define yourself:

- **Today** — a live timeline of today's schedule, with a day-progress strip, a spotlight card for what's happening now, and mark done / skip / delay controls.
- **Stats** — weekly hours per category, streaks for any category you've marked as a "job hunt" or "family" type, applications logged, adherence.
- **Settings** — a full schedule editor: add, edit, or delete any block on your weekday or weekend schedule (label, category, start/end time), and manage the categories those blocks use (name, color, type, which drives the notification sound and stats streaks). Nothing is fixed to a specific number of blocks or a specific routine — build your day from scratch or start from the example weekday/weekend template that ships on first run and reshape it.

Native OS notifications (with a distinct sound per category on macOS) fire before and at the start/end of each block. The app lives in the menu bar tray — closing the window just hides it, the tray keeps everything running in the background.

### Claude Runners

Tracks recurring Claude Code routines (set up via the `/schedule` skill):

- Routines are auto-discovered from `~/.claude/scheduled-tasks/*/SKILL.md` — real name, description, and prompt, no API needed. This works for whatever routines *you* have set up locally; nothing here is tied to any particular routine name.
- Link a routine to the output file it overwrites each run (via a native file picker). The app polls every 5 minutes, and whenever that file changes it archives a dated snapshot and parses it.
- Each day's snapshot is browsable as a real table (not an embedded spreadsheet) — sheets render as tabs, with a "Reveal original file" button for the raw file.
- Any routine that produces a spreadsheet with a "Title/Company/Score/..." style sheet can additionally be picked as your **Job Hunt pipeline** in Settings, to power the Home dashboard's job-hunt card.

### Claude Code

Brings interactive Claude Code sessions into the app itself:

- **History** — every past session is auto-discovered straight from `~/.claude/projects/**/*.jsonl` (no import step), listed with its title, working directory, last-active time, and message count. Click through to a read-only transcript view.
- **Terminal** — a real embedded terminal (`node-pty` + `xterm.js`) driving your own already-authenticated `claude` CLI. Start a fresh session in any directory, or hit **Resume** on a past one from History to pick a conversation back up. One live session at a time; it keeps running in the background if you navigate away or hide the window, and is only stopped by an explicit Stop, starting a replacement, or quitting the app. Normal Claude Code permission prompts still appear — the app never passes `--dangerously-skip-permissions`.
- The binary is auto-detected (login shell, then common install locations like nvm/Homebrew/Volta); override the path manually in Settings if needed.

## Tech stack

Electron + React + TypeScript, scaffolded with `electron-vite`. `better-sqlite3` for storage, `exceljs` for reading workbook snapshots, `recharts` for charts, `date-fns` for date handling, `auto-launch` for the login item, `node-pty` + `xterm.js` for the embedded Claude Code terminal. The Home dashboard's weather chip calls the Open-Meteo REST API directly from the main process (`fetch`, no SDK).

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Optional, to use the Claude Runners / Claude Code modules: [Claude Code](https://code.claude.com) installed and logged in on the same machine

### Clone and install

```bash
git clone https://github.com/<your-fork>/personal-tracker.git
cd personal-tracker
npm install
```

### Run it

```bash
npm run dev
```

This launches the Electron app in dev mode. On first launch it creates its own local SQLite database (see [Data](#data)) seeded with a small example schedule and sample dashboard content — nothing personal, nothing that requires configuration before the app is usable.

### Build a standalone app

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

The production build is unsigned (no code-signing certificate configured) — on macOS, right-click the built app and choose **Open** the first time to get past Gatekeeper.

## First-run configuration

Everything below is optional — the app works out of the box with example data — but worth doing once so it reflects your own life instead of the example template:

1. **Your schedule** — go to **Time Management → Settings** and edit, delete, or add blocks to the weekday/weekend schedule. Add whatever categories you need (name, color, type) in the same page; a category's *type* determines its notification sound and which stats streak it counts toward.
2. **Your name** (optional) — **Time Management → Settings → Profile & weather**. Shown in the Home dashboard's greeting; leave it blank for a generic greeting.
3. **Your weather location** (optional) — same section. Defaults to Kochi, India; set your own location label and lat/lon (look them up on a site like [latlong.net](https://www.latlong.net)).
4. **Job Hunt pipeline** (optional) — if you have a Claude Code routine that scrapes/scores job listings into a spreadsheet, set it up with the `/schedule` skill, link its output file from the **Routines** page, then pick it as your **Job Hunt pipeline** in **Time Management → Settings**. Nothing is auto-linked by routine name.
5. **Claude binary path** (optional) — only needed if auto-detection in **Time Management → Settings → Claude Code** doesn't find your `claude` install.
6. **Interview prep plan** (optional) — edit the Home dashboard's plan directly from its "Edit plan" toggle, or delete the example weeks and add your own.

## Data

Everything is stored locally under Electron's `userData` path (e.g. `~/Library/Application Support/personal-tracker` on macOS, `%APPDATA%/personal-tracker` on Windows, `~/.config/personal-tracker` on Linux): the SQLite database and archived routine snapshots. Nothing is synced anywhere, and there's no login or account of any kind — each clone/install is independent.

The one exception is the Home dashboard's weather chip, which calls the public Open-Meteo API every 30 minutes for whatever lat/lon you've configured — no account, key, or personal data involved.

## Platform notes

- Built and tested primarily on macOS; `electron-builder` is configured for macOS, Windows, and Linux (dmg, nsis, AppImage/deb/snap).
- Native notification *sounds* are macOS-only today (the notifications themselves still fire cross-platform via Electron); on other platforms you'll get the notification without the distinct per-category sound.
- The menu bar tray icon and "launch at login" behavior use cross-platform Electron/`auto-launch` APIs.
