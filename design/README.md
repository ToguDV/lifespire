# LifeSpire — The Quiet Ascent

A visual MVP proposal for LifeSpire: a calm, seven-day path game inspired by the route structure of Slay the Spire. This folder is standalone. It does not touch the Vite app in the repository root.

The design is a field journal: near-monochrome stone and ink, one moss accent, Alegreya display type, and a vertical map that carries every choice. It covers a light and a night theme, desktop and mobile shells, and seven screens.

## Open it

Open `design/index.html` directly, or serve the folder:

```bash
cd design
python3 -m http.server 8765
```

Then visit:

- `http://localhost:8765/index.html` — the proposal, with plates and notes
- `http://localhost:8765/app.html` — the interactive prototype

The prototype uses hash routes. Add `?theme=dark` for the night palette, or use the theme control in either page.

## The screens

Seven base screens, plus the rest-node variant.

| Screen | Route | What it shows |
|---|---|---|
| Map | `app.html#map` | The centerpiece: camp, five layers, two open choices, current node, locked route, boss gate |
| Camp | `app.html#camp` | The quiet hub: today's path, recent finds, the week, weekly aims |
| Aims | `app.html#aims` | Wayfarer, Hearth, and Craft routines with weekly progress |
| Reliquary | `app.html#reliquary` | Profile, collection counts, and relic cards by rarity |
| Node detail | `app.html#node` | A task step with rewards, weekly aim progress, and primary/skip actions |
| Rest variant | `app.html?node=rest#node` | The same detail surface for a no-task rest node |
| Day summary | `app.html#summary` | A sealed day: path rows, totals, aims, level-up, and exits |
| Welcome | `app.html#welcome` | First-run name entry and the spire illustration |

## What is implemented

- Hash routing between all seven screens
- Theme toggle with `localStorage` persistence and `meta[name="theme-color"]` sync
- Task/rest variants for the node detail
- Responsive shell: bottom tabs below 960px; 240–256px sidebar at 960px; map and camp rails at 1200px and above
- Mobile map dock, side-positioned labels for open nodes, and a compact short-height mode
- Self-hosted Alegreya and Alegreya Sans; no external requests
- Static visual states for buttons, inputs, segmented controls, pips, and map nodes
- Reduced-motion support

The only intentional persistence is the theme. There is no game state, account, backend, local save, or real reward logic.

## Captures

All final screenshots are in `captures/`:

- `map-desktop-light.png`, `map-desktop-dark.png`
- `map-mobile-light.png`, `map-mobile-dark.png`
- `map-detail-light.png`, `map-detail-dark.png`
- `camp-desktop-light.png`, `camp-mobile-dark.png`
- `aims-desktop-light.png`, `aims-mobile-dark.png`
- `reliquary-desktop-light.png`, `reliquary-mobile-dark.png`
- `node-desktop-light.png`, `node-mobile-dark.png`, `node-rest-mobile-dark.png`
- `summary-desktop-light.png`, `summary-mobile-dark.png`
- `welcome-desktop-light.png`, `welcome-desktop-dark.png`
- `welcome-mobile-light.png`, `welcome-mobile-dark.png`

Desktop captures are 1440 × 900; mobile captures are 390 × 844. The map detail crops are 744 × 674.

## Design system

`DESIGN.md` is the reference document. It follows the getdesign `DESIGN.md` format: YAML frontmatter for colours, typography, radii, spacing, and components, followed by Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts, Responsive Behavior, Iteration Guide, and Known Gaps.

Token sources live in `assets/tokens.css`; application styles in `assets/app.css`; the presentation page styles in `assets/showcase.css`.

## File map

```text
design/
├── index.html              proposal page
├── app.html                static interactive prototype
├── DESIGN.md               design-system reference
├── README.md               this file
├── assets/
│   ├── tokens.css          colour, type, space, radius, motion tokens
│   ├── app.css             prototype shell and components
│   ├── app.js              routing, theme, node variants
│   ├── showcase.css        proposal page
│   └── fonts/              Alegreya + Alegreya Sans WOFF2
└── captures/               final desktop/mobile screenshots
```

## Notes

- The run is a fixed day-3 snapshot: Run I, day 3 of 7, 240 gold, level 4, Wayfarer 2/5. Rewards and the sealed summary are illustrative.
- The copy is English placeholder. No localisation layer is included.
- The project is intentionally framework-free. No build step is needed.
- Alegreya and Alegreya Sans are self-hosted under the SIL Open Font License 1.1.
