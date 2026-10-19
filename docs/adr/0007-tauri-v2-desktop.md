# ADR-007: Tauri v2 for desktop (reuses the web build)

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §5.2, §11](../../ARCHITECTURE.md), ADR-011

## Context

Desktop is a secondary platform (phase M4) whose value is native notifications, timers that survive closing the app and a small install. Electron would ship a full Chromium runtime and a large RAM footprint for a UI that already exists as a web build.

## Decision

`apps/desktop` wraps the **web build** in **Tauri v2**, reusing the same UI and outbox logic rather than reimplementing the game. It adds `tauri-plugin-sql` (SQLite) for durable local storage, native notifications and system tray, deep links, and a signed auto-updater. No game logic is duplicated inside the app shell.

## Consequences

- + Binaries in the tens of megabytes, low RAM use and native OS integration.
- + One UI to maintain for web and desktop; a fix lands in both.
- + Rust-side capability model keeps the desktop surface explicit and auditable.
- − A Rust toolchain joins the build matrix and CI must produce signed artifacts per OS.
- − WebView differences across OS versions (WebView2, WebKitGTK) require smoke tests.
