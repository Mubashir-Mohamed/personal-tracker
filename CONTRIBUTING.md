# Contributing

Thanks for your interest in Personal Tracker! This is a self-hosted, single-user
Electron app — everyone who clones it runs their own independent instance, so
contributions here are mostly about improving the app itself (features, bug
fixes, docs), not about a shared/hosted service.

By participating in this project you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Optional, to work on the Claude Runners / Claude Code modules:
  [Claude Code](https://code.claude.com) installed and logged in locally

### Setup

```bash
git clone https://github.com/<your-fork>/personal-tracker.git
cd personal-tracker
npm install
npm run dev
```

This launches the Electron app in dev mode with hot reload. See the
[README](README.md#getting-started) for more on first-run configuration and
where local data lives.

## Making changes

1. Fork the repo and create a branch off `master` for your change
   (`git checkout -b my-feature`).
2. Make your changes, keeping them focused — smaller, single-purpose PRs are
   easier to review.
3. Match the existing code style (TypeScript, React function components).
   Run the checks below before opening a PR:

   ```bash
   npm run lint
   npm run typecheck
   npm run format
   ```

4. Test your change by running the app (`npm run dev`) and exercising the
   affected module.
5. Commit with a clear, descriptive message explaining *why*, not just *what*.
6. Push to your fork and open a pull request against `master` using the
   [PR template](.github/PULL_REQUEST_TEMPLATE.md) — it'll be filled in
   automatically.

## Reporting bugs / requesting features

Please use the [issue templates](.github/ISSUE_TEMPLATE) — they ask for the
context (OS, steps to reproduce, etc.) that makes a report actionable.

For security vulnerabilities, do **not** open a public issue — see
[SECURITY.md](SECURITY.md) instead.

## Project structure

- `src/main` — Electron main process (SQLite access, tray, notifications,
  Claude CLI integration)
- `src/preload` — context-bridge APIs exposed to the renderer
- `src/renderer` — React UI

See the [README](README.md) for a full module-by-module overview.

## Questions

Open a [discussion or issue](../../issues) if anything here is unclear.
