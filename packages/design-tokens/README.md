# @lifespire/design-tokens

Single source of the LifeSpire visual language — the **"ink & ember"** art
direction (dark, minimal, no sidebar; GDD §B6, ADR-011). Web and (partially)
mobile consume it; **no component hardcodes a color, font, radius or duration**.

## Entries

| Export | File | Use |
| --- | --- | --- |
| `@lifespire/design-tokens/tokens` | `src/tokens.ts` | Typed token objects (`colors`, `fonts`, `radii`, `motion`). |
| `@lifespire/design-tokens/css` · `./tokens.css` | `src/tokens.css` | CSS custom properties (`--ls-*`), incl. `prefers-reduced-motion`. |

## Consuming the tokens from Tailwind CSS 4

Tailwind 4 no longer uses a JS preset; web maps the tokens to its theme with
`@theme inline` inside its own `styles.css` and imports the token sheet first:

```css
@import 'tailwindcss';
@import '@lifespire/design-tokens/tokens.css';

@theme inline {
  --color-bg: var(--ls-bg);
  --color-surface: var(--ls-surface);
  --color-surface-2: var(--ls-surface-2);
  /* ... one entry per token ... */
  --font-ui: var(--ls-font-ui);
  --font-display: var(--ls-font-display);
  --radius-sm: var(--ls-radius-sm);
  --radius-md: var(--ls-radius-md);
  --radius-lg: var(--ls-radius-lg);
}
```

That yields utilities such as `bg-surface`, `text-gold`, `stroke-event`,
`font-display` or `rounded-md` derived from the single token source, so no
component hardcodes a color, font or radius. The earlier `tailwind-preset.ts`
was removed when the web app moved to Tailwind 4.

## Color tokens

| Token | Hex | Role |
| --- | --- | --- |
| `bg` | `#0B0D12` | App background |
| `surface` | `#141821` | Panels, cards |
| `surface2` | `#1C212C` | Raised surface |
| `border` | `#2A3040` | Borders, dividers |
| `text` | `#E8E4DA` | Primary text |
| `muted` | `#8B93A7` | Secondary text |
| `gold` | `#E0A94A` | Current node halo, rewards |
| `xp` | `#8FB6D9` | Experience |
| `danger` | `#C2554F` | Damage, failure |
| `success` | `#6FA46A` | Success |
| `rest` | `#C97B4A` | Rest nodes |
| `event` | `#9B8CD6` | Event nodes |

Typography: `ui` = Inter (+ system fallback), `display` = Fraunces.
Radii: `sm` 6px, `md` 10px, `lg` 16px. Motion: `fast` 150ms, `base` 200ms,
`slow` 250ms. Under `prefers-reduced-motion: reduce` only opacity cross-fades
are allowed.

This package ships TypeScript source (no build step); bundlers compile it.
