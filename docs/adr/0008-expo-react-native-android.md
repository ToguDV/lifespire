# ADR-008: React Native + Expo for Android, own UI

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §5.3, §11](../../ARCHITECTURE.md), ADR-011, ADR-014

## Context

The phone is where the daily loop actually happens: camera evidence, push reminders, timers in the background, SQLite persistence. The Android UI is intentionally narrower than the web one (map, task, timer, camera, day close), so sharing markup would force compromises on both sides.

## Decision

`apps/mobile` is a **React Native + Expo** app for Android with its **own UI** — no `react-native-web` sharing of components with `apps/web`. It reuses only `packages/engine` (rules, map layout) and `packages/shared-types` (DTO schemas), plus partially `design-tokens`. Persistence uses `expo-sqlite`, notifications use `expo-notifications` (FCM/APNs), and evidence uses `expo-camera`/`expo-image-picker` with compression before upload (ADR-014). It speaks the same outbox/sync protocol as web (ADR-006).

## Consequences

- + Layout and gestures tuned to the phone instead of bent around DOM constraints.
- + One shared rules engine keeps the phone's map identical to web's.
- + Expo handles native build and OTA concerns, which matters at personal-project scale.
- − Two UIs to maintain and keep visually coherent through shared tokens.
- − Divergence risk between web and mobile flows; critical paths need their own smoke tests.
