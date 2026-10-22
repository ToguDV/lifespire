---
version: alpha
name: LifeSpire — The Quiet Ascent
description: >-
  LifeSpire is a calm, near-monochrome daily path game. The design reads as a field journal rather
  than a dashboard: warm stone paper, deep ink, one moss accent, and a single vertical map that
  carries every choice. Alegreya supplies the medieval, literary voice; Alegreya Sans keeps small
  labels and controls legible. The shell is mobile-first, with a fixed map dock and bottom tabs,
  growing into a 240px sidebar at 960px and right-hand rails at 1200px.

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
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: 46px
    border: "1px solid {colors.ink}"
  button-primary-night:
    backgroundColor: "{colors.ink-night}"
    textColor: "{colors.canvas-night}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: 46px
    border: "1px solid {colors.ink-night}"
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
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    height: 64px
    border: "1px solid {colors.hairline}"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink-strong}"
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
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    size: 45px
    border: "1px solid {colors.ink}"
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
  map-dock:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
    border: "1px solid {colors.hairline}"
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
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
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

> Source: `design/assets/tokens.css`. Day values are the semantic defaults; Night values live under the `-night` suffix and replace the same roles under `html[data-theme="dark"]`. All body-text pairings meet WCAG AA.

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
- **Moss Soft** ({colors.accent-soft}): The current-day wash, active aim rows, quiet emphasis.
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

## Typography

### Font Family
**Alegreya** (display): A warm old-style serif with a genuine italic. It gives the product its field-journal voice. Used for `h1`–`h3`, place names, seals, day numerals, and large stats. Weights 400–700; italic 400–700. Self-hosted WOFF2 at `assets/fonts/`.

**Alegreya Sans** (interface): Humanist sans with high x-height and excellent small-size behaviour. Used for body copy, controls, navigation, micro labels, and metadata. Weights 400, 500, 700. Self-hosted WOFF2.

Fallbacks: `Iowan Old Style`, `Palatino Linotype`, Georgia for display; `Gill Sans`, `Trebuchet MS`, sans-serif for UI. No external font request.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 84px | 600 | 1.08 | -0.015em | Welcome title, hero display |
| `{typography.display-lg}` | 60px | 600 | 1.08 | -0.015em | Screen titles, large map name |
| `{typography.display-md}` | 40px | 600 | 1.06 | -0.015em | Node title, welcome section |
| `{typography.heading-lg}` | 28.8px | 600 | 1.12 | -0.01em | Section headings, summary title |
| `{typography.heading-md}` | 20px | 600 | 1.25 | 0 | Panel titles, aim group names |
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
- **One editorial exception.** The proposal cover uses a 102px hero display; the product UI caps `{typography.display-xl}` at 84px.

## Layout

### Spacing System
- **Base unit**: 4px.
- **Tokens**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 20px · `{spacing.xl}` 24px · `{spacing.xxl}` 32px · `{spacing.xxxl}` 40px · `{spacing.xxxxl}` 56px · `{spacing.section}` 72px.
- **Screen rhythm**: topbar 56px; screen heads 16–32px horizontal; 22px vertical; content gutters 16px on phones, 32–40px on desktop.
- **Density**: list rows use 8–12px vertical padding; map panels use 16–20px; summary cards use 24–30px. Nothing sits tighter than 8px.

### Grid & Container
- **Mobile shell**: full viewport, topbar 56px, one scrolling viewport, tab bar 64px. Horizontal gutter 16px. The map dock floats 10px above the tab bar.
- **Desktop shell**: 240px sidebar (256px at 1280px and above) plus a fluid main column. At 1440px the content area is approximately 1184px wide.
- **Map**: a 4:5 canvas, height-led, centered in its frame. The rail is hidden below 1200px, 312px from 1200–1279px, and 336px at 1280px and above.
- **Camp**: a two-column grid, `minmax(0, 1fr)` + 340px rail, with a 24px gap. Below 960px the rail and week strip are removed. From 960–1199px the rail is removed but the week strip remains in a full-width camp. At 1200px the rail returns.
- **Aims**: a 3-column weekly grid plus a 300px right rail on desktop; one column on mobile.
- **Summary**: a 720px maximum card, centered in the main area, with a two-column totals row and a compact aim list.

### Whitespace Philosophy
Negative space is part of the calm. Screens use generous top padding and quiet endings rather than filling every pixel. On desktop, content may end well above the fold; that is intentional paper margin. On mobile, partial next sections are acceptable because the viewport scrolls, but the first view should always show the next action: the map nodes and dock, the camp CTA, the node's primary button.

## Elevation & Depth

The system is predominantly flat. Surfaces separate through one hairline and a very soft ambient shadow, not through heavy lifting.

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | 1px `{colors.hairline}` border; no shadow | Panels, rows, inputs, sidebars |
| 1 (soft) | `0 1px 2px rgba(29,33,25,.04), 0 16px 40px -32px rgba(29,33,25,.40)` | Map frame, plates, camp hero, summary card |
| 2 (float) | `0 2px 3px rgba(29,33,25,.05), 0 24px 56px -28px rgba(29,33,25,.36)` | Map dock, welcome art, phone frame |
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
| `{rounded.xl}` | 18px | Map frame, summary card, map dock |
| `{rounded.xxl}` | 24px | Welcome art, phone frame |
| `{rounded.full}` | 9999px | All buttons, chips, pips, node medallions, seals |

### Geometry
- **Nodes are circles.** The visible medallion is 38–50px; the button target is always 54px. The current node gets a 3px surface gap and a 4.5px moss ring.
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
- Background `{colors.ink}`, text `{colors.canvas}`, typography `{typography.button}`, rounded `{rounded.full}`, padding `0 20px`, height 46px, border 1px `{colors.ink}`.
- Night resolves to `{colors.ink-night}` on `{colors.canvas-night}` via `button-primary-night`.
- Pressed: scale 0.98 and `{colors.accent-deep}` background; no shadow change.

**`button-quiet`** — Secondary action that should not compete.
- Transparent background, text `{colors.ink-muted}`, 1px `{colors.hairline}` border, `{rounded.full}`, height 44px.
- Used for "Skip this step", "Choose another path", "Create my own path".

**`button-ghost`** — Tertiary, text-only action. Transparent; no border; 40px height; used for "View the week" and small route controls.

**`button-icon`** — Circular utility button.
- Background `{colors.surface}`, text `{colors.ink-muted}`, border `{colors.hairline}`, size 36px, `{rounded.full}`.
- Used for the theme switch and future audio/settings. Minimum 44px touch target via padding on mobile.

### Navigation

**`topbar`** — Mobile and desktop run header.
- Background `{colors.canvas}`, height 56px, bottom border `{colors.hairline}`.
- Left: wordmark + spire mark. Center/left: day pips and `Day 3 of 7`. Right: gold, level, XP meter, theme switch.

**`sidebar`** — Desktop run rail.
- Width 240px from 960–1279px and 256px at 1280px and above; background `{colors.surface-sunken}`, right border `{colors.hairline}`.
- Top: wordmark, "a quiet ascent", "The run" micro label. Primary nav: Map, Camp, Aims, Reliquary.
- Bottom: profile card (level badge, name, level/XP), appearance label, theme switch.

**`sidebar-item-active`** — Current section.
- Background `{colors.surface-raised}`, text `{colors.ink-strong}`, border `{colors.hairline}`, rounded `{rounded.lg}`. A 2px moss inset on the left is optional; the raised surface is the primary signal.

**`bottom-tabs`** — Mobile primary navigation.
- Background `{colors.canvas}`, height 64px, top border `{colors.hairline}`, four equal tabs.
- Default: 20px line icon above 10.5px uppercase label in `{colors.ink-muted}`.
- Active: `{colors.ink-strong}` label/icon and a 26px × 2px moss bar at the top edge (`tab-active`).

### Map

**`map-frame`** — The centerpiece container.
- Background `{colors.surface}` with a radial `{colors.accent-wash}` at the top, rounded `{rounded.xl}`, border `{colors.hairline}`, shadow level 1.
- A second inset 1px border sits 7px inside; it is decorative and low opacity.
- Frame meta: `THE ASCENT · 2 OF 5 CLEARED` on the left, `Day III` in Alegreya italic on the right.

**`map-node-button`** — 54×54px transparent button with a concentric medallion. The button, not the medallion, is the touch target.
- Completed: done-fill medallion, done-ink icon, 15px moss seal with a check at bottom-right. A small 3px surface gap keeps seals legible.
- Current: ink medallion with a 3px surface gap and 4.5px moss ring, plus a `HERE` micro label on desktop only. On mobile the ring is the sole marker.
- Available: 50px surface-raised medallion, moss border, 4px moss-soft halo, moss-deep icon; a second 1px moss ring at 1.2 scale. These are the only nodes with a filled surface and a pointer.
- Locked: 45px transparent medallion with a dashed `{colors.hairline-strong}` rim, 52% opacity, and the future node icon. No lock glyph on the map; the dashed rim is the lock.
- Start: 38px dashed medallion with a tent, canvas fill. The label sits below at 10.5px uppercase.
- Boss: 76×82px dashed hexagon, surface-raised fill, crown icon, `{colors.ink-soft}`. Its label sits above the gate; `BOSS · LOCKED` is micro text.

**`map-dock`** — Mobile next-step chooser.
- Surface-raised, rounded `{rounded.xl}`, 1px hairline, shadow level 2; pinned 10px above the tab bar with safe-area inset.
- Head: `CHOOSE YOUR NEXT STEP` micro + `2 PATHS LIT` moss caption.
- Two `node-choice-row`s: 34px icon well, title in `{typography.heading-sm}`, reward line in `{typography.micro}`/moss, chevron right.
- Desktop hides the dock and shows `map-rail` instead.

**`map-rail`** — Desktop companion panel.
- Surface panel with 20px padding, rounded `{rounded.lg}`, hairline border.
- Sections: Next step (two choice rows), Weekly aims (three aim rows with pips), legend (Task, Elite, Rest, Treasure, Boss).

**Paths**
- Walked: 1.7px solid `{colors.ink}` at 78% opacity.
- Open: 1.5px moss dashed 3/7.
- Veiled: 1.5px `{colors.hairline-strong}` dashed 1/8.
- Boss halo: dashed hairline ellipse with `{colors.accent-wash}` fill.

### Chips, Pips, and Signals

**`chip`** — Metadata pill for node type, effort, or state.
- Surface, hairline border, rounded `{rounded.full}`, 26px minimum height, 3px 10px padding, caption 700.
- Small icon optional at 12–13px.

**`chip-accent`** — Moss-soft background, moss-deep text, moss border. Used for weekly aim deltas and current-day markers.

**`day-pip`** — 6px diamond. Active `{colors.accent}`; completed days filled; future days `{colors.hairline-strong}`. Day 3 is a filled current pip in the screen head; the topbar shows completed days only.

**`progress-pip`** — 6×13px rounded bar for weekly aims. Filled `{colors.accent}`, empty `{colors.hairline}`. Pips are always paired with a numeric `3 / 5` label; they are not the only signal.

**`resource-counter`** — 14px coin/level icon + display-face number. Gold, level, and XP never rely on colour; each has an icon and a label.

### Forms

**`text-input`** — Name field and future routine input.
- Surface background, 1px `{colors.hairline-strong}`, rounded `{rounded.md}`, 44px height, 10px 12px padding, body-md.
- Placeholder uses `{colors.ink-soft}`. Focus ring is the global moss ring, not a new border colour.
- Labels are micro, 700, tracked; they sit above the field, never inside as placeholder-only.

**`segmented-control`** — Effort selector (Light / Medium / Deep).
- Surface-sunken track, hairline border, rounded `{rounded.full}`, 3px inner padding.
- Active segment is filled ink with canvas text; inactive is transparent with muted text. The active state is also announced with `aria-pressed`/group semantics if implemented.

### Cards and Panels

**`summary-card`** — Sealed day report.
- Surface, 1px hairline, rounded `{rounded.xl}`, 24–30px padding, shadow level 1.
- Head: place name in micro caps, display title, italic subtitle, and a round `seal` on the right.
- Five path rows: 36px icon, title + type micro, reward right. Skipped rows use a dashed medallion and "No reward".
- Totals row: three equal cells with icon, display number, and micro label. A dashed `level-up` strip below, then the aims and actions.

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
- Let the mobile map dock repeat the two available names and their rewards. The map can hide labels at 360px; the dock must not.
- Keep tap targets at 44px minimum; the map node button is 54px even when the visible medallion is 38px.
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
| Small mobile | 320–479px | Single column. Map labels move beside open nodes; frame meta hidden below 700px height; dock and bottom tabs. |
| Mobile | 480–959px | Single column with 16–20px gutters. Bottom tabs; camp rail hidden; Aims rail stacks below. Map remains 4:5. |
| Compact desktop | 960–1199px | 240px sidebar; full-width content column; no side rails. Map takes the full main column; week strip visible. |
| Desktop | 1200–1279px | Sidebar plus 312px map rail and camp rail; the three-column layout returns. |
| Wide desktop | ≥ 1280px | 40px outer gutters; 336px map rail; wider camp grid; larger display type. |

### Touch Targets
- Map node buttons: 54×54px; visible medallion 38–50px.
- Primary/secondary buttons: 44–46px height.
- Tab bar items: full 64px height; icon + label.
- Icon buttons: 36px visible; expand hit area to 44px with padding or a pseudo-element.
- Day pips and progress pips are decorative; they are never interactive.

### Collapsing Strategy
- **Map dock**: fixed above the tab bar on mobile; hidden at 960px. From 960–1199 the map frame uses the full main column and the nodes are the direct actions; the rail returns at 1200px.
- **Map rail**: hidden below 1200px. Below 960 the dock carries the two choice rows; at 960–1199 the full-width map and its labels do the work.
- **Camp rail**: hidden below 1200px. From 960–1199px the week strip carries the overview; below 960px the Aims tab does. The topbar carries gold/level in both cases.
- **Aims rail**: stacks below the three aim groups below 1200px; "Add a routine" becomes a full-width form. At 1200px it returns as a right rail.
- **Summary**: card stays single-column; the totals row stays three columns; actions wrap if needed.
- **Welcome**: copy first on mobile, art below; two columns at 960px.
- **Typography**: fluid clamps; display 44–84px, heading 20–28.8px, body 15px, micro 10.5px.
- **Overflow**: no horizontal scroll at 320, 390, 768, 960, 1024, 1200, or 1440. Long map labels are positioned outside the stage on compact screens but clipped by the map frame, never by the viewport.

### Image Behavior
- Screenshots are static; the real map is inline SVG with `vector-effect: non-scaling-stroke`.
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
7. Run the prototype with `theme=light`, `theme=dark`, and no query (system) to confirm the pre-paint theme and the switch stay in sync.
8. If a new state is added, document it in the node grammar and add a text label; never rely on opacity alone.

## Known Gaps

- Visual-only prototype: no backend, accounts, save data, or real game logic. The name field and primary actions are visual except for hashing and theme persistence.
- The run is a fixed day-3 snapshot (Run I, 240 gold, level 4, Wayfarer 2/5). Rewards, level-up, and the sealed summary are illustrative rather than simulated.
- No empty, error, failure, offline, audio, haptic, or onboarding-validation states.
- No combat or deck-building loop; the product is a day-keeper, not a card battler.
- No localization layer; all copy is English placeholder.
- No dark-mode asset variants beyond the token swap; the screenshots are captured from the live prototype.
- The map label collision threshold is handled with a 1199px side-label layout and a 700px-height compact mode; extremely short landscape phones (< 600px wide and < 420px tall) are not covered.
- Hover states are not specified; implementation may add a 180ms border/translate response without changing meaning.
- Focus trapping, modal behavior, and form validation are not implemented because there are no modal or submit flows yet.
