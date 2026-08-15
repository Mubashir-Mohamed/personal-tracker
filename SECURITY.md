# Security Policy

## Supported Versions

Personal Tracker is a self-hosted, single-user desktop app without formal
version releases yet. Security fixes are applied to the `master` branch;
there's no older version actively maintained in parallel.

| Version | Supported          |
| ------- | ------------------ |
| latest (`master`) | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public
GitHub issue.

Instead, report it privately by emailing **mubashir585@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (a minimal repro is very helpful)
- Any relevant logs, screenshots, or proof-of-concept code

You should receive an acknowledgement within a few days. Once the issue is
confirmed, a fix will be prioritized and you'll be credited in the release
notes (unless you'd prefer to stay anonymous).

## Scope notes

Since the app is self-hosted and single-user by design:

- All data is stored locally in SQLite under the OS's app-data directory —
  there is no server, account system, or shared backend in scope.
- The only outbound network call is a weather lookup to the public
  [Open-Meteo](https://open-meteo.com) API and Claude CLI invocations you run
  locally — no credentials or personal data are sent as part of either.
- Reports about the general security posture of Electron itself (e.g. Chromium
  CVEs) are welcome but will generally be resolved by bumping the `electron`
  dependency rather than an app-level fix.
