---
version: alpha
name: LifeSpire — The Quiet Ascent
description: >-
  LifeSpire is a calm, near-monochrome daily path game. The design reads as a field journal rather
  than a dashboard: warm stone paper, deep ink, one moss accent, and a single vertical map that
  carries every choice. Alegreya supplies the medieval, literary voice; Alegreya Sans keeps small
  labels and controls legible. The shell is mobile-first, with bottom tabs and the map rail stacked
  under the frame, growing into a 240px sidebar at 960px and right-hand rails at 1200px.

colors:
  canvas: "#F1F0EA"
  surface: "#F8F7F2"
  surface-raised: "#FCFBF7"
  surface-sunken: "#E9E7DF"
  ink: "#20241E"
  ink-strong: "#12160F"
  ink-muted: "#61665B"
  ink-soft: "#64695D"
  hairline: "#D8D5C9"
  hairline-strong: "#B9B6A8"
  accent: "#4D6B5A"
  accent-deep: "#385342"
  accent-soft: "#DFE7DE"
  accent-wash: "rgba(77, 107, 90, 0.075)"
  on-accent: "#F8F7F2"
  scrim: "rgba(22, 26, 20, 0.42)"
  canvas-night: "#131511"
  surface-night: "#191C17"
  surface-raised-night: "#20231D"
  surface-sunken-night: "#0E100C"
  ink-night: "#E8E5D9"
  ink-strong-night: "#F5F2E7"
  ink-muted-night: "#A3A598"
  ink-soft-night: "#8B8F82"
  hairline-night: "#2C3028"
  hairline-strong-night: "#40453A"
  accent-night: "#9DBBA8"
  accent-deep-night: "#C5DACB"
  accent-soft-night: "#263229"
  accent-wash-night: "rgba(157, 187, 168, 0.08)"
  on-accent-night: "#131511"
  scrim-night: "rgba(5, 7, 4, 0.62)"
  wheel-task: "#20241E"
  wheel-gold: "#385342"
  wheel-xp: "#4D6B5A"
  wheel-rest: "#6B5A3E"
  wheel-stroke: "#40453A"
  wheel-icon: "#F1F0EA"

typography:
  display-xl:
    fontFamily: Alegreya
    fontSize: 84px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.015em
  display-lg:
    fontFamily: Alegreya
    fontSize: 60px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.015em
  display-md:
    fontFamily: Alegreya
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: -0.015em
  heading-lg:
    fontFamily: Alegreya
    fontSize: 28.8px
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: -0.01em
  heading-md:
    fontFamily: Alegreya
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  heading-sm:
    fontFamily: Alegreya
    fontSize: 16.8px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  body-lg:
    fontFamily: "Alegreya Sans"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-md:
    fontFamily: "Alegreya Sans"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "Alegreya Sans"
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "Alegreya Sans"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0.01em
  micro:
    fontFamily: "Alegreya Sans"
    fontSize: 10.5px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.16em
  button:
    fontFamily: "Alegreya Sans"
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.02em

rounded:
  xs: 4px
  sm: 8px
  md: 10px
  lg: 14px
  xl: 18px
  xxl: 24px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  xxxxl: 56px
  section: 72px
  sidebar: 240px
  topbar: 56px
  tabbar: 64px

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: 44px
    border: "1px solid {colors.accent}"
  button-primary-night:
    backgroundColor: "{colors.accent-night}"
    textColor: "{colors.on-accent-night}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: 44px
    border: "1px solid {colors.accent-night}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: 44px
    border: "1px solid {colors.hairline}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: 40px
    border: "0"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    size: 36px
    border: "1px solid {colors.hairline}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
    border: "1px solid {colors.hairline}"
  chip-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-deep}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
    border: "1px solid {colors.accent}"
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: 44px
    border: "1px solid {colors.hairline-strong}"
  topbar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    height: 56px
    border: "0 0 1px {colors.hairline} solid"
  sidebar:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    width: 240px
    height: "100dvh"
    border: "0 1px 0 0 {colors.hairline} solid"
  sidebar-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
    border: "1px solid {colors.hairline}"
  bottom-tabs:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.caption}"
    height: 64px
    border: "1px solid {colors.hairline}"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    padding: "8px 4px"
    border: "2px 0 0 {colors.accent} solid"
  day-pip:
    backgroundColor: "transparent"
    rounded: "{rounded.xs}"
    size: 7px
    border: "1px solid {colors.hairline-strong}"
  day-pip-done:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    size: 7px
    border: "1px solid {colors.ink}"
  day-pip-today:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.xs}"
    size: 7px
    border: "1px solid {colors.accent}"
  map-frame:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.hairline}"
  map-node-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 54px
    border: "0"
  map-medallion:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    size: 45px
    border: "1px solid {colors.hairline-strong}"
  map-medallion-available:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.accent-deep}"
    rounded: "{rounded.full}"
    size: 50px
    border: "1px solid {colors.accent}"
  map-medallion-current:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 45px
    border: "1px solid {colors.accent}"
    ring: "3px {colors.surface-raised} gap + 4.5px {colors.accent}"
  map-medallion-locked:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    size: 45px
    border: "1px dashed {colors.hairline-strong}"
  map-boss:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.heading-sm}"
    width: 76px
    height: 82px
    border: "1px dashed {colors.hairline-strong}"
  map-rail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.hairline}"
  node-choice-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    border: "1px solid {colors.hairline}"
  aim-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: "11px 0"
    border: "0 0 1px {colors.hairline} solid"
  progress-pip:
    backgroundColor: "{colors.hairline}"
    rounded: "{rounded.full}"
    width: 6px
    height: 13px
  progress-pip-active:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    width: 6px
    height: 13px
  segmented-control:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "3px"
    border: "1px solid {colors.hairline}"
  segmented-control-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "6px"
    padding: "6px 12px"
    shadow: "0 1px 2px rgba(0, 0, 0, 0.08)"
  summary-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.xl}"
    padding: "24px 30px"
    border: "1px solid {colors.hairline}"
  seal:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-deep}"
    typography: "{typography.heading-md}"
    rounded: "{rounded.full}"
    size: 86px
    border: "1px solid {colors.accent}"
  welcome-art:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.xxl}"
    padding: "0"
    border: "1px solid {colors.hairline}"
  resource-counter:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "0"
    padding: "0 4px"
  weekly-aim-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: "10px 0"
    border: "0 0 1px {colors.hairline} solid"
---

> **Status.** This document is the design-system specification for the shipped
> application. The app itself — `src/` and `public/` — is the visual reference:
> it is what runs, and it is where any new state must be built. The static HTML
> proposal that used to live in this folder has been retired; its tokens were
> ported to `src/styles/tokens.css` and its rules are recorded below.

## Overview

LifeSpire is a daily path game about small promises. It borrows the silhouette of a deck-building roguelike — a branched route, a handful of choices, a run that ends — but replaces combat with the routines a person actually keeps. The interface is a field journal: warm stone paper, deep ink, and a single moss accent. The map is the largest surface and the strongest state change. Everything else exists to help the player read it.

Alegreya carries the literary, slightly medieval voice. Its italic is used for place names, seals, and the emotional line; the roman is used for titles and numbers. Alegreya Sans handles body copy, controls, and micro labels, so the old face never has to compromise legibility. The palette is near-monochrome: five stone/ink roles per theme, one moss signal. There are no gradients, purple, brass, or parchment textures. The grain is a 3.5%–5% noise overlay, not a brand colour.

**Key Characteristics:**
- One vertical map per day, read bottom-to-top from camp to a locked boss gate.
- One accent (`{colors.accent}`) reserved for open choices, the current step, gain, and one display italic.
- Two complete palettes: `Day` and `Night`, mapped through CSS custom properties.
- Alegreya display + Alegreya Sans interface; no third typeface.
- Stone shapes: circles for nodes, 14–24px rounding for surfaces, 1px hairlines.
- A mobile shell (topbar + scrolling viewport + four tabs) that becomes a 240px sidebar at 960px; the map and camp rails join at 1200px.
- Motion is short and calm: 180ms ease-out for controls, one 260ms screen entry, both removed under `prefers-reduced-motion`.

## Colors

> Source: `src/styles/tokens.css`. Day values are the semantic defaults; Night values live under the `-night` suffix and replace the same roles under `html[data-theme="dark"]`. All body-text pairings meet WCAG AA.

### Day
- **Canvas** ({colors.canvas}): The page floor and the colour of paper in daylight.
- **Surface** ({colors.surface}): Panels, cards, and the map frame. A half-step lighter than canvas.
- **Surface Raised** ({colors.surface-raised}): Raised cards, inputs, open node medallions.
- **Surface Sunken** ({colors.surface-sunken}): Sidebar floor, inset wells, quiet controls.
- **Ink** ({colors.ink}): Primary text and filled actions.
- **Ink Strong** ({colors.ink-strong}): Display headings and the smallest high-emphasis labels.
- **Ink Muted** ({colors.ink-muted}): Body copy and secondary labels. Approximately 5.2:1 on canvas.
- **Ink Soft** ({colors.ink-soft}): Captions, metadata, and disabled-adjacent text. Approximately 4.9:1 on canvas.
- **Hairline** ({colors.hairline}): The default 1px divider and surface border.
- **Hairline Strong** ({colors.hairline-strong}): Input borders, medallion rims, veiled paths.
- **Done Fill** ({colors.done-fill}): Completed nodes. Day is deep stone: the past is solid.
- **Done Rim** ({colors.done-rim}): The 1px edge of a completed medallion and the boss frame.
- **Done Ink** ({colors.done-ink}): The icon inside a completed medallion.
- **Moss** ({colors.accent}): The only accent. Open choices, current state, gain, progress.
- **Moss Deep** ({colors.accent-deep}): Text on moss-soft backgrounds and italic display accents.
- **Moss Soft** ({colors.accent-soft}): The current-day wash, active goal rows, quiet emphasis.
- **Moss Wash** ({colors.accent-wash}): Atmospheric radial wash on the map and welcome art.
- **On Accent** ({colors.on-accent}): Text and icons placed on filled moss or ink.
- **Scrim** ({colors.scrim}): The only overlay, used behind modal surfaces if added.

### Night
- **Night Canvas** ({colors.canvas-night}): Deep green-black, not pure black.
- **Night Surface** ({colors.surface-night}): The next plane up, still low-contrast.
- **Night Surface Raised** ({colors.surface-raised-night}): Cards and open medallions after dark.
- **Night Surface Sunken** ({colors.surface-sunken-night}): Sidebar and inset wells.
- **Night Ink** ({colors.ink-night}): Warm off-white; never blue-white.
- **Night Ink Strong** ({colors.ink-strong-night}): Highest-emphasis text and filled buttons.
- **Night Ink Muted** ({colors.ink-muted-night}): Body copy, approximately 7.3:1 on canvas.
- **Night Ink Soft** ({colors.ink-soft-night}): Metadata, approximately 5.6:1 on canvas.
- **Night Hairline** ({colors.hairline-night}): 1px dividers that disappear before they distract.
- **Night Hairline Strong** ({colors.hairline-strong-night}): Inputs and medallion rims.
- **Night Done Fill** ({colors.done-fill-night}): Quiet stone for completed nodes. A bright disc would glare on the night canvas, so the medallion never reaches the lightness of text ink.
- **Night Done Rim** ({colors.done-rim-night}): The 1px edge of a completed medallion.
- **Night Done Ink** ({colors.done-ink-night}): The icon inside a completed medallion.
- **Night Moss** ({colors.accent-night}): Open choices and current state. Lifted to sage for contrast.
- **Night Moss Deep** ({colors.accent-deep-night}): Text on soft moss and display italics.
- **Night Moss Soft** ({colors.accent-soft-night}): Current-day wash.
- **Night Moss Wash** ({colors.accent-wash-night}): Atmospheric wash.
- **Night On Accent** ({colors.on-accent-night}): Text/icons on filled light surfaces.
- **Night Scrim** ({colors.scrim-night}): Deeper than day; 0.62 alpha.

### Rules
- **Moss never decorates.** If an element is not open, current, a gain, or the single welcome italic, it stays stone.
- **Completed nodes are stone, not moss.** The past is solid; the possible is green. Day fills the medallion with deep ink; Night uses Done Fill so a finished node never glares.
- **Locked states are transparent with a dashed rim.** They never use a red or a warning icon.
- **No second semantic colour.** Boss, rest, task, and elite are distinguished by shape, icon, and label — not hue.
- **Gold and danger are not system roles.** The palette is ink, moss, and stone only. Currency and gems use moss-deep; destructive actions and warnings use stone surfaces with `hairline-strong` borders and ink text. "Gold" survives only as a wheel-sector label, never as a colour token.

### Mobile Type Ramp

The Android app derives its ramp from the same web clamps at 320–480px:
`display-xl` 44/48, `display-lg` 36/39, `display-md` 27/29, `heading-lg`
22.5/25, with a 16px horizontal gutter. Numerals use Alegreya at 18/21 with
tabular figures so counters do not jitter while animating.

## Typography

### Font Family
**Alegreya** (display): A warm old-style serif with a genuine italic. It gives the product its field-journal voice. Used for `h1`–`h3`, place names, seals, day numerals, and large stats. Weights 400–700; italic 400–700. Self-hosted WOFF2 in `public/fonts/`.

**Alegreya Sans** (interface): Humanist sans with high x-height and excellent small-size behaviour. Used for body copy, controls, navigation, micro labels, and metadata. Weights 400, 500, 700. Self-hosted WOFF2.

Fallbacks: `Iowan Old Style`, `Palatino Linotype`, Georgia for display; `Gill Sans`, `Trebuchet MS`, sans-serif for UI. No external font request.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 84px | 600 | 1.08 | -0.015em | Welcome title, hero display |
| `{typography.display-lg}` | 60px | 600 | 1.08 | -0.015em | Screen titles, large map name |
| `{typography.display-md}` | 40px | 600 | 1.06 | -0.015em | Node title, welcome section |
| `{typography.heading-lg}` | 28.8px | 600 | 1.12 | -0.01em | Section headings, summary title |
| `{typography.heading-md}` | 20px | 600 | 1.25 | 0 | Panel titles, goal group names |
| `{typography.heading-sm}` | 16.8px | 600 | 1.3 | 0 | Card titles, node names |
| `{typography.body-lg}` | 17px | 400 | 1.6 | 0 | Long-form welcome copy |
| `{typography.body-md}` | 15px | 400 | 1.5 | 0 | Primary body copy |
| `{typography.body-sm}` | 13.5px | 400 | 1.5 | 0 | Secondary body, list rows |
| `{typography.caption}` | 12px | 500 | 1.5 | 0.01em | Dates, metadata, supporting notes |
| `{typography.micro}` | 10.5px | 700 | 1.2 | 0.16em | Kickers, legends, tab labels (uppercase) |
| `{typography.button}` | 13px | 700 | 1.4 | 0.02em | Button and control labels |

### Principles
- **Display is literary, not loud.** Large Alegreya is set at 0.9–1.08 line-height; italics carry warmth without another colour.
- **Micro labels are structural.** They are uppercase, 10.5px, 700 weight, and 0.16em tracked. They are never used for sentences.
- **Body copy never drops below 13.5px** on mobile. The smallest text is metadata, not content.
- **Numbers use the display face.** Gold, levels, XP, day numbers, and seals are set in Alegreya with lining figures.
- **Two faces, two jobs.** Alegreya for voice; Alegreya Sans for action and instruction.
- **One editorial exception.** The design proposal cover used a 102px hero display; the product UI caps `{typography.display-xl}` at 84px.

## Layout

### Spacing System
- **Base unit**: 4px.
- **Tokens**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 20px · `{spacing.xl}` 24px · `{spacing.xxl}` 32px · `{spacing.xxxl}` 40px · `{spacing.xxxxl}` 56px · `{spacing.section}` 72px.
- **Screen rhythm**: topbar 56px; screen heads 16–32px horizontal; 22px vertical; content gutters 16px on phones, 32–40px on desktop.
- **Density**: list rows use 8–12px vertical padding; map panels use 16–20px; summary cards use 24–30px. Nothing sits tighter than 8px.

### Grid & Container
- **Mobile shell**: full viewport, topbar 56px, one scrolling viewport, tab bar 64px. Horizontal gutter 16px. The map rail stacks below the frame; no floating dock sits above the tab bar.
- **Desktop shell**: 240px sidebar (256px at 1280px and above) plus a fluid main column. At 1440px the content area is approximately 1184px wide.
- **Map**: a height-led canvas whose 560px-wide viewBox grows with the day's layer count (570–2130px tall), centered in its frame and scrolling vertically when it does not fit. Below 1200px the shipped web and Android both stack the rail under the frame; from 1200–1279px it becomes a 312px side rail and 336px at 1280px and above.
- **Camp**: a two-column grid, `minmax(0, 1fr)` + 340px rail, with a 24px gap. Below 960px the rail and week strip are removed. From 960–1199px the rail is removed but the week strip remains in a full-width camp. At 1200px the rail returns.
- **Goals**: a 3-column weekly grid plus a 300px right rail on desktop; one column on mobile.
- **Summary**: a 720px maximum card, centered in the main area, with a two-column totals row and a compact goal list.

### Whitespace Philosophy
Negative space is part of the calm. Screens use generous top padding and quiet endings rather than filling every pixel. On desktop, content may end well above the fold; that is intentional paper margin. On mobile, partial next sections are acceptable because the viewport scrolls, but the first view should always show the next action: the map nodes and the Next step panel, the camp CTA, the node's primary button.

## Elevation & Depth

The system is predominantly flat. Surfaces separate through one hairline and a very soft ambient shadow, not through heavy lifting.

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | 1px `{colors.hairline}` border; no shadow | Panels, rows, inputs, sidebars |
| 1 (soft) | `0 1px 2px rgba(29,33,25,.04), 0 16px 40px -32px rgba(29,33,25,.40)` | Map frame, plates, camp hero, summary card |
| 2 (float) | `0 2px 3px rgba(29,33,25,.05), 0 24px 56px -28px rgba(29,33,25,.36)` | Welcome art, phone frame |
| 3 (overlay) | `{colors.scrim}` behind the surface | Any future modal or sheet |

**Night shadows** use `rgba(0,0,0,.24)` and `rgba(0,0,0,.90)`; they are deeper because the canvas is deeper, but they remain ambient. A 1px border always accompanies a shadow, so a surface remains legible without it.

**Grain**: a fixed SVG turbulence overlay at 3.5% opacity (`multiply`) in Day and 5% (`screen`) in Night. It is atmosphere, never texture on type or controls. It is pointer-events none and sits above content but below the skip link.

**Focus**: 2px `{colors.accent}` outline with 3px offset. Buttons and inputs do not add a shadow on focus; the ring is enough.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Tiny chips, grain tiles, map dots |
| `{rounded.sm}` | 8px | Small controls, path labels |
| `{rounded.md}` | 10px | Inputs, map choice rows |
| `{rounded.lg}` | 14px | Panels, plates, sidebar active state |
| `{rounded.xl}` | 18px | Map frame, summary card |
| `{rounded.xxl}` | 24px | Welcome art, phone frame |
| `{rounded.full}` | 9999px | All buttons, chips, pips, node medallions, seals |

### Geometry
- **Nodes are circles.** The visible medallion is 40–50px (45/50, or 40/44 on five-node layers); the button target is always 54px. The current node gets a 3px surface gap and a 4.5px moss ring. On Android the ring is the only current marker; the micro `HERE` label stays desktop-only.
- **The boss is a hexagon.** A 76×82px dashed outline contains a crown. It is the only non-circular node, so it reads before a label.
- **Paths are 1.5–1.7px lines.** Walked paths are solid ink; open paths are 3/7 moss dashes; veiled paths are 1/8 hairline dashes.
- **Day pips are diamonds.** Six-pixel squares rotated 45°; moss for completed days, hairline for the remainder.
- **Two radii in one view.** The map frame and summary card use 18px; the plates inside use 14px. No card is nested more than one level.

## Components

> Hover states are intentionally omitted from the specification. Default, active, and pressed states are documented. Hover polish may be added in implementation, but it must never carry meaning.
>
> Components reference the Day semantic tokens. Under Night, the same roles resolve to their `-night` values; the material contrast pairs (such as `button-primary-night`) are listed explicitly.

### Buttons

**`button-primary`** — The single dominant action on a screen.
- Background `{colors.accent}`, text `{colors.on-accent}`, typography `{typography.button}`, rounded `{rounded.md}`, padding `0 18px`, height 44px, border 1px `{colors.accent}`.
- Night resolves to `{colors.accent-night}` on `{colors.on-accent-night}` via `button-primary-night`.
- Pressed: scale 0.98 and `{colors.accent-deep}` background; no shadow change.

**`button-quiet`** — Secondary action that should not compete.
- Transparent background, text `{colors.ink-muted}`, 1px `{colors.hairline}` border, `{rounded.full}`, height 44px.
- Used for "Skip this step", "Choose another path", "Create my own path".

**`button-ghost`** — Tertiary, text-only action. Transparent; no border; 40px height; used for "View the week" and small route controls.

**`button-icon`** — Circular utility button.
- Background `{colors.surface}`, text `{colors.ink-muted}`, border `{colors.hairline}`, size 36px, `{rounded.full}`.
- Used for the theme switch and future audio/settings. Minimum 44px touch target via padding on mobile.

### Navigation

**`topbar`** — Run header.
- Background `{colors.canvas}`, height 56px on phones, 14px horizontal gutter, bottom border `{colors.hairline}`.
- Mobile: left, the 21px spire mark plus the wordmark; right, gold (16px coin), `Lv N`, the theme switch and Settings.
- The day pips and `Day 3 of 7` are **not** in the mobile topbar: each screen carries them in its `screen-head`.
- At 960px and above the same bar adds the run label, pips, day label and XP meter.

**`sidebar`** — Desktop run rail.
- Width 240px from 960–1279px and 256px at 1280px and above; background `{colors.surface-sunken}`, right border `{colors.hairline}`.
- Top: wordmark, "a quiet ascent", "The run" micro label. Primary nav: Map, Camp, Goals, Reliquary.
- Bottom: profile card (level badge, name, level/XP), appearance label, theme switch.

**`sidebar-item-active`** — Current section.
- Background `{colors.surface-raised}`, text `{colors.ink-strong}`, border `{colors.hairline}`, rounded `{rounded.lg}`. A 2px moss inset on the left is optional; the raised surface is the primary signal.

**`bottom-tabs`** — Mobile primary navigation.
- Background `{colors.canvas}`, height 64px, top border `{colors.hairline}`, four equal tabs.
- Default: 21px line icon above a 10px uppercase label (`tab`, 13px line, 0.6px tracking) in `{colors.ink-soft}`.
- Active: `{colors.ink}` label/icon and a 26px × 2px moss bar at the top edge (`tab-active`).

### Map

**`map-frame`** — The centerpiece container.
- Background `{colors.surface}` with a radial `{colors.accent-wash}` at the top, rounded `{rounded.xl}`, border `{colors.hairline}`, shadow level 1.
- A second inset 1px border sits 7px inside; it is decorative and low opacity.
- Frame meta: `THE ASCENT · 2 OF N RESOLVED` on the left, where N is the day's
  decision layers + 1 (4–16); `Day III` in Alegreya italic on the right.
- Empty variant (sealed or locked day, or a path not drawn yet): the same frame,
  border and inset, with `THE ASCENT · BEYOND THE VEIL` and the day numeral (or
  `—`), decorative contour lines, a centered `EmptyState` and the compass. It is
  a map frame, never a generic panel.
- `map-altimeter`: a decorative vertical hairline on the left edge (desktop
  only), with one roman numeral per decision layer aligned to the fixed 130px
  layer step. It is `aria-hidden` and shares the canvas geometry, so it never
  introduces a second scroll region or a separate coordinate system.

**`map-node-button`** — 54×54px transparent button with a concentric medallion. The button, not the medallion, is the touch target.
- Completed: done-fill medallion, done-ink icon, 15px moss seal with a check at bottom-right. A small 3px surface gap keeps seals legible.
- Current: surface-raised medallion with a 3px surface gap and 4.5px moss ring, plus a `HERE` micro label on desktop only (web at 960px and above). Android never renders `HERE`; the ring is the sole marker.
- Available: 50px surface-raised medallion (44px on five-node layers), moss border, 4px moss-soft halo, moss-deep icon; a second 1px moss ring at 1.2 scale. These are the only nodes with a filled surface and a pointer.
- Locked: 45px transparent medallion (40px on five-node layers) with a dashed `{colors.hairline-strong}` rim, 52% opacity, and the future node icon. No lock glyph on the map; the dashed rim is the lock.
- Task, elite, and boss medallions show the goal's crest instead of the type glyph. Elite adds a 15px star mark at top-right in every state (completed, skipped, locked and open); the boss keeps its hexagon frame. `rest` and `treasure` keep campfire and chest icons because they have no goal.
- Labels: 78px maximum width (64px on dense layers of three or more nodes), 124px above the boss. Labels stay hidden at rest — including the current node — so the map stays quiet. On touch screens the first tap reveals the title and the second tap selects the node; only available and current nodes reveal.
- Start: 38px dashed medallion with a tent, canvas fill. The label sits below at 10.5px uppercase.
- Boss: 76×82px dashed hexagon, surface-raised fill, goal crest, `{colors.ink-soft}`. Its label sits above the gate.
- The frame exposes the group label “Day map. Camp at the bottom, N layers above, and the boss at the top.” to TalkBack without grouping or hiding the node buttons.

**`map-dock` (retired)** — The floating mobile next-step chooser is gone.
- No screen pins a dock above the tab bar; Android stacks the full `map-rail`
  below the frame in the single scrolling viewport.
- The dock's choice rows survive inside the Next step panel, so the rail is the
  only next-step surface on every width.

**`map-rail`** — The map companion, stacked under the frame below 1200px and shown beside the map from 1200px.
- Surface panels with 16–20px padding, rounded `{rounded.lg}`, hairline border, 12–14px gap.
- Three sections, always present — even when the day has no playable map: Next step (choice rows, or the sealed/locked/veiled copy and the foot note), Weekly targets (`AimRow` with goal crest, pips and `3 / 5`), Legend (Task, Elite, Rest, Treasure, Wheel, Boss). The contextual day action (read the summary, return to camp, open the path) lives in the empty map frame, never in the rail.
- On Android the rail is never hidden: it follows the frame in the same vertical scroll. The shipped web keeps the same stacked layout below 1200px.

**Paths**
- Walked: 1.7px solid `{colors.ink}` at 78% opacity.
- Open: 1.5px moss dashed 3/7.
- Veiled: 1.5px `{colors.hairline-strong}` dashed 1/8.
- Boss halo: dashed hairline ellipse with `{colors.accent-wash}` fill.

### Wheel

**`wheel`** — The wheel node's one-shot outcome picker. Web and Android share
the spin physics (`packages/app-core/src/ui/wheel.ts`); the canonical visual
geometry below is mirrored by `apps/mobile/src/components/wheelGeometry.ts`.
On Android the wheel sits right after the node tags and before the facts so the
primary action stays near the first viewport on a 390×844 screen.

- Disc 200×200 with ten 36° sectors: 5 task, 2 gold, 2 xp, 1 rest. Every wedge
  spans `wheelSectorCenter(i) ± 18°`; separators are 1px `{colors.wheel-stroke}`.
- Outer ring: 6px `{colors.hairline-strong}` plus the soft `0 12px 30px
  rgba(0,0,0,.35)` shadow (elevation on Android).
- Fixed 52px hub outside the rotating layer: `{colors.wheel-task}` fill, 2px
  `{colors.wheel-stroke}` border and `?` in display 24px `{colors.wheel-icon}`.
  On reveal it takes the winning sector fill and a 22px Lucide sector icon.
- Sector icons are Lucide `scroll`, `coin`, `star` and `campfire`, 16px at a
  62px radius, centered on each sector angle. They are decorative; the wrapper
  carries the accessible label "Wheel of outcomes".
- Pointer: 20×18px triangle in `{colors.wheel-icon}` above the disc; it flicks
  −18° on every sector crossing during the spin.
- Spin: only from the primary "Spin the wheel"; idle → spinning → revealed.
  9.1s, four full turns, easeOutQuart, native-driven rotation. The button is
  hidden during the spin and replaced by "Spinning…"; Android emits a throttled
  haptic tick every two sector crossings and one impact on reveal. Android
  bundles no wheel sound. The web's looping hub pulse and glow are intentionally
  omitted on Android to respect the no-loop motion rule; the static hub, ticks
  and pointer flicks carry the spinning state.
- Reveal: a 1.8s hold. Losing sectors drop to 45% opacity; the winner keeps a
  2px `{colors.wheel-icon}` stroke plus a single non-looping highlight. The
  in-place result card uses surface-raised, a `{colors.hairline-strong}` border,
  12px radius, 12px padding and 8px gap: outcome line in display 20px
  `{colors.ink-strong}`, rewards in UI `{colors.ink}`, with a 400ms one-shot
  scale/fade entry.
- Reduced motion skips the spin and opens the recap immediately. "Skip this
  step" and its note show before the spin, disable while spinning and disappear
  once the outcome is revealed.
- The wheel is theme-invariant: Day and Night use the same wheel-task,
  wheel-gold, wheel-xp, wheel-rest, wheel-stroke and wheel-icon values.

### Chips, Pips, and Signals

**`chip`** — Metadata pill for node type, effort, or state.
- Surface, hairline border, rounded `{rounded.full}`, 26px minimum height, 3px 10px padding, caption 700.
- Small icon optional at 12–13px.

**`chip-accent`** — Moss-soft background, moss-deep text, moss border. Used for weekly target deltas and current-day markers.

**`day-pip`** — 7px diamond. Active `{colors.accent}`; completed days filled; future days `{colors.hairline-strong}`. Day 3 is a filled current pip in the screen head; the mobile topbar omits the pips and the `Day 3 of 7` label.

**`progress-pip`** — 6×13px rounded bar for weekly goals. Filled `{colors.accent}`, empty `{colors.hairline}`. Pips are always paired with a numeric `3 / 5` label; they are not the only signal.

**`resource-counter`** — 14px coin/level icon + display-face number. Gold, level, and XP never rely on colour; each has an icon and a label.

### Forms

**`text-input`** — Name field and future routine input.
- Surface background, 1px `{colors.hairline-strong}`, rounded `{rounded.md}`, 44px height, 10px 12px padding, body-md.
- Placeholder uses `{colors.ink-soft}`. Focus ring is the global moss ring, not a new border colour.
- Labels are micro, 700, tracked; they sit above the field, never inside as placeholder-only.

**`segmented-control`** — Effort selector (Light / Medium / Deep).
- Surface-sunken track, hairline border, rounded `{rounded.full}`, 3px inner padding.
- Active segment is filled surface-raised with ink text and a `0 1px 2px` shadow; inactive is transparent with muted text. The active state is also announced with `aria-pressed`/group semantics if implemented.

**`icon-picker`** — Goal crest selector.
- Native radio group inside a fieldset; every tile is at least 44×44px and keeps the visible label (or an `sr-only` label in compact mode).
- Tile: surface, 1px hairline, rounded `{rounded.md}`, 20px line icon centered above a 9.6px label. Hover raises the border to hairline-strong.
- Selected: moss border, moss-soft fill, a 2px moss-soft ring and a 13px check badge at top-right. The check keeps the selection legible in forced-colors mode, where the moss fill is suppressed. Focus-visible adds the global moss outline. The crest also previews in the goal header and weekly rails.

### Cards and Panels

**`summary-card`** — Sealed day report.
- Surface, 1px hairline, rounded `{rounded.xl}`, 24–30px padding, shadow level 1.
- Head: place name in micro caps, display title, italic subtitle, and a round `seal` on the right.
- Five path rows: 36px icon, title + type micro, reward right. Skipped rows use a dashed medallion and "No reward".
- Totals row: three equal cells with icon, display number, and micro label. A dashed `level-up` strip below, then the goals and actions.

**`seal`** — Day seal.
- 86px circle, `{colors.accent-wash}` fill, moss border, double ring inset, day numeral in display 600, `DAY` micro beneath.
- On mobile it shrinks with the card but never drops below 64px.

**`map-frame`**, **`map-rail`**, **`node-choice-row`**, **`aim-row`** — as specified above.

### Welcome

**`welcome-art`** — A single custom SVG plate: a slender spire on a mound, a halo, a dotted path, four small trail nodes, pines, and a crescent. Stroke only, no fills except the halo wash. It is decorative (`role="presentation"`) and never carries information.

**Welcome form** — One name input, a primary "Begin with demo data", a quiet "Create my own path", and a privacy line with a lock icon. On mobile the copy comes first; the art follows below the fold. On desktop the art sits on the right and the copy is vertically centered.

## Do's and Don'ts

### Do
- Keep the map as the largest and most contrasted surface on the screen.
- Reserve `{colors.accent}` for open choices, current position, gain, and at most one display italic per screen. If a use is none of those, make it ink or hairline.
- Use `{rounded.full}` for buttons, chips, pips, and node medallions; use 14–18px for panels and 24px for the welcome art.
- Pair every visual state with a shape or text cue: dashed rim for locked, check seal for completed, numeric pips for progress.
- Set display type in Alegreya and controls in Alegreya Sans. Use the italic for one emphasis per screen.
- Let a node's first tap reveal its title and keep the label quiet at rest; the map stays legible through shape, ring and icon.
- Keep tap targets at 44px minimum; the map node button is 54px even when the visible medallion is 40px.
- Use hairline borders and one soft shadow. Depth should be felt, not seen.

### Don't
- Don't use purple, brass, heavy parchment, leather, or metallic gradients. The medieval note comes from type and hairlines, not props.
- Don't use moss on completed nodes or decorative headings; it would stop meaning "open".
- Don't fill a completed node medallion with text ink. A medallion is a surface, not a glyph: use Done Fill so a finished node stays a quiet stone in both themes.
- Don't introduce a red error palette for locked nodes. Locked is a permission state, not a failure.
- Don't nest cards more than one level. A card may contain rows; it must not contain another bordered card.
- Don't set body copy below 13.5px or micro labels below 10.5px.
- Don't use more than one accent per viewport or more than one italic display line per screen.
- Don't fill the whole screen with panels. Paper margins are part of the design.
- Don't animate more than one property per state. No bouncing, pulsing, or looping motion.

## Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Small mobile | 320–479px | Single column. Map labels move beside open nodes; frame meta hidden below 700px height; stacked rail and bottom tabs. |
| Mobile | 480–959px | Single column with 16–20px gutters. Bottom tabs; camp rail hidden; Goals rail stacks below. Map keeps its layer-derived aspect ratio. |
| Compact desktop | 960–1199px | 240px sidebar; full-width content column; no side rails. Map takes the full main column; week strip visible. |
| Desktop | 1200–1279px | Sidebar plus 312px map rail and camp rail; the three-column layout returns. |
| Wide desktop | ≥ 1280px | 40px outer gutters; 336px map rail; wider camp grid; larger display type. |

### Touch Targets
- Map node buttons: 54×54px; visible medallion 40–50px (45/50, 40/44 on five-node layers).
- Primary/secondary buttons: 44–46px height.
- Tab bar items: full 64px height; icon + label.
- Icon buttons: 36px visible; expand hit area to 44px with padding or a pseudo-element.
- Day pips and progress pips are decorative; they are never interactive.

### Collapsing Strategy
- **Map dock**: retired. No platform ships the floating dock; Android and the shipped web stack the `map-rail` below the frame. The full-width map and its labels remain the direct actions from 960–1199px, and the rail returns beside the map at 1200px.
- **Map rail**: stacked below the frame on Android at every width and on the shipped web below 1200px; at 960–1199 the full-width map and its labels do the work.
- **Camp rail**: hidden below 1200px. From 960–1199px the week strip carries the overview; below 960px the Goals tab does. The topbar carries gold/level in both cases.
- **Goals rail**: stacks below the three goal groups below 1200px; "Add a routine" becomes a full-width form. At 1200px it returns as a right rail.
- **Summary**: card stays single-column; the totals row stays three columns; actions wrap if needed.
- **Welcome**: copy first on mobile, art below; two columns at 960px.
- **Typography**: fluid clamps; display 44–84px, heading 20–28.8px, body 15px, micro 10.5px.
- **Overflow**: no horizontal scroll at 320, 390, 768, 960, 1024, 1200, or 1440. Long map labels are positioned outside the stage on compact screens but clipped by the map frame, never by the viewport.

### Image Behavior
- Raster assets are static; the real map is inline SVG with `vector-effect: non-scaling-stroke`.
- Decorative illustrations are inline SVG, stroke-only, and `role="presentation"`.
- The welcome art uses `xMidYMin slice` on mobile so the spire stays visible when the art is short; the camp map art uses `xMidYMid slice` and crops its edges.
- Fonts are self-hosted WOFF2; no external requests. Images use explicit dimensions to avoid layout shift.

## Iteration Guide

1. Start from the map. Any change to node state must survive at 320px wide, 960px with the sidebar, and 1200px with the rail visible.
2. Reference tokens directly (`{colors.accent}`, `{typography.display-md}`, `{rounded.xl}`); do not invent one-off hexes or sizes.
3. Prefer a shape or text change over a new colour. The system has exactly one accent and one warning-adjacent state (locked), and locked is not red.
4. When adding a screen, give it one primary action and one quiet exit. Reuse `map-frame`, `summary-card`, or `map-rail` before inventing a container.
5. Keep the mobile first view action-led. If a new panel pushes the primary action below the fold, collapse the panel into a tab or a disclosure.
6. Test both themes at 390×844 and 1440×900, then check 320×700 for label collisions, 960×900 for the sidebar, and 1200×900 for the rails.
7. Run the app in Day, Night and system themes (`pnpm dev`, then the theme control) to confirm the pre-paint theme and the switch stay in sync.
8. If a new state is added, document it in the node grammar and add a text label; never rely on opacity alone.

## Known Gaps

- No backend, accounts, or cloud sync: the app is local-first and keeps every document in `localStorage`.
- No audio or haptic feedback.
- No combat or deck-building loop; the product is a day-keeper, not a card battler.
- No localization layer; all copy is English placeholder.
- No dark-mode asset variants beyond the token swap.
- The map label collision threshold is handled with a 1199px side-label layout and a 700px-height compact mode; extremely short landscape phones (< 600px wide and < 420px tall) are not covered.
- Hover states are not specified; implementation may add a 180ms border/translate response without changing meaning.
