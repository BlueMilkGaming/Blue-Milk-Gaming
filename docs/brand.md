# Blue Milk Gaming — Brand

Canonical source files live in `assets/brand/`. Web-ready copies used by the site live in `website/public/brand/` and `website/src/app/fonts/`.

## Colors

| Name | Hex | Tailwind token | Usage |
|---|---|---|---|
| Deep Space | `#000342` | `deep-space` | Page background |
| Blue Milk | `#3BB0FF` | `blue-milk` | Primary accent, links, headings |
| Naboo | `#FFE81F` | `naboo` | Highlight / call-to-action accent (use sparingly) |
| Hoth | `#EEFBFF` | `hoth` | Body text on dark backgrounds |

Defined as Tailwind v4 theme tokens in `website/src/app/globals.css`, giving utilities like `text-blue-milk`, `bg-deep-space`, `border-naboo/40`.

## Typography

**Hubot Sans** (open-source, by GitHub).

- Primary — **Extra Bold** (`weight 800`): headings, the wordmark
- Secondary — **Medium** (`weight 500`): body copy

Loaded with `next/font/local` in `website/src/app/layout.tsx` from `website/src/app/fonts/`, exposed as the `--font-hubot-sans` CSS variable and wired to Tailwind's `font-sans`.

> **Gotcha:** the Tailwind block referencing `--font-hubot-sans` must be `@theme inline`. A plain `@theme` block flattens the variable at build time, before next/font defines it on `<body>`, and the font silently falls back to system sans.

## Logos

Canonical sets in `assets/brand/`:

| Folder | Contents |
|---|---|
| `Main Logos/` | Icon and the two primary lockups (full color, for light backgrounds) |
| `Larger Logos/` | High-resolution versions of the primary lockups |
| `Logos for Dark Backgrounds/` | All-white lockups |
| `Logos for Light Backgrounds/` | All-black lockups |
| `White Outline/` | Full-color with white outline — for dark backgrounds |
| `Alternate Logos/` | All-white and all-yellow variants |
| `Social/` | Banner and social avatars |
| `SVGs/` | Vector versions (see caveat below) |
| `Fonts/` | Hubot Sans Extra Bold + Medium (TTF) |
| `JKDesigns-BMG-Logo-Designs.pdf` | Original designer source |

Lockups come in two shapes: **Logo 1** is stacked (icon above wordmark), **Logo 2** is horizontal (icon beside wordmark).

### In use on the site

- `website/public/brand/logo-horizontal.png` — primary lockup, full color with white outline. Reads well on Deep Space. Downsized to 1200×453 from the 4000px canonical file.
- `website/public/brand/icon.svg` — carton icon only, vector.

> **Gotcha:** Next.js image optimization is turned **off** (`images.unoptimized` in `website/next.config.ts`). OpenNext's optimizer Lambda returns a 500 against Next 15.5 (`TypeError: s is not a function`), and ADR 0001 rules it out at this scale anyway. Nothing resizes images at request time, so **size assets before committing them** — resize from the canonical file in `assets/brand/` into `website/public/brand/`, e.g. `sips -Z 1200 <source> --out <dest>`.

> **Gotcha:** the wordmark SVGs (`SVGs/Asset 1.svg`, `SVGs/Asset 3.svg`) store the wordmark as live `<text>` referencing Hubot Sans, not as outlined paths. Loaded through `<img>`/`next/image` they render with a fallback serif and the letters collapse into each other. Use the PNG lockups on the web until these are re-exported with text converted to outlines. `BMG-Icon-SVG.svg` contains no text and is safe to use as-is.
