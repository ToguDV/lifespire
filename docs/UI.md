# UI notes — shell, tokens and components

`design/` is the accepted visual reference. The React UI ports it rather than
inventing a parallel system.

## Sources

| Prototype | App |
| --- | --- |
| `design/assets/tokens.css` | `src/styles/tokens.css` (font URLs point to `/fonts/`) |
| `design/assets/app.css` | `src/styles/app.css` (copied) |
| `design/assets/fonts/*.woff2` | `public/fonts/*.woff2` |
| `design/app.html` sprite (`i-*`) | `src/ui/components/Icon.tsx` |

Small additions that the prototype did not need live in `src/styles/ui.css`:
dialogs, toast, empty states, the development panel, recovery and the settings
screen. They use the same tokens and component classes. No UI kit, router or
third-party visual asset is used.

## Shell and navigation

`src/ui/App.tsx` renders the desktop sidebar, mobile topbar and tabbar, skip
link, `<main id="main-content">`, theme controls and the current screen. The
view is a discriminated union in `src/domain/types.ts`; `view` and `history`
are transient store state and are never persisted.

Navigation targets: Map, Camp (home), Aims, Reliquary and Settings. Node detail,
day summary and run summary are reached from Map or Camp. Without a profile the
shell is hidden by `body[data-screen="welcome"]` and onboarding is shown. A
blocked save forces recovery. Map, node and day-summary views fall back to camp
(or the run summary when the run is closed). Profile-without-run lands on camp,
which shows the honest "No run yet" state and a real start button; map remains
unreachable until a run exists.

Theme is stored as `light | dark | system`. Explicit themes set
`html[data-theme]`; `system` removes the attribute so the `prefers-color-scheme`
rules in `tokens.css` apply. Screen changes move focus to `<main>`.

## Components

`src/ui/components/`:

- `Button` — primary / secondary / quiet / danger, optional small and full.
  `quiet` maps to the prototype's `btn--ghost`.
- `IconButton`, `Icon`, `IconSprite` — the prototype sprite, one icon family.
- `Panel`, `PanelHead`, `ScreenHead`.
- `Progress`, `Pips`, `DayPips`, `Stat`, `StatStrip`, `Resource`,
  `LevelResource`, `EffortDots`, `AimRow`, `LootCard`.
- `Dialog` — focus trap, `Esc`, backdrop click, focus restoration and
  `role="dialog"`.
- `Toast` — polite feedback for store messages.

Every component emits the ported classes (`btn`, `panel`, `chip`, `pips`,
`screen-head`, etc.), so custom CSS is only needed for new UI states.

## Accessibility

Visible `:focus-visible`, a skip link, 44 px primary targets, labelled icon
buttons, semantic headings, keyboard-operable navigation and focus trapping in
dialogs. `prefers-reduced-motion` is handled by `tokens.css`; new animations use
the same duration/easing tokens.
