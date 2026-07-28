# Design

<!-- impeccable:design-schema 1 -->

## World: Club Season Program

Blue Milk Gaming is presented as a **sports club**, not a software product. The
recurring weekly Online Local is a *season with a league table*; the four
members are *the squad*; the leaderboard is *the table*; YouTube is *highlights*;
sponsors are *club partners*. The skin is **broadcast matchday graphics** —
sharp horizontal bars, tracked-caps labels, live status tags, tabular data —
rendered in Star Wars: Unlimited's own cockpit palette. This deliberately
refuses the category default (dark-neon esports hero + glowing logo + "JOIN THE
SQUAD"). Warmth and a real recurring season are what make "Join the Discord"
land as *join the supporters*.

## Palette (Deep Space cockpit)

Brand tokens are fixed (see `docs/brand.md`); this surface adds tonal navies.

| Token | Hex | Role |
|---|---|---|
| `deep-space` | `#000342` | Page ground |
| `recess` | `#00021C` | Table stripes, deep recesses, footer |
| `panel` | `#0A1352` | Raised panels, cards, the fixture board |
| `blue-milk` | `#3BB0FF` | Structure, labels, links, hairlines (via alpha) |
| `naboo` | `#FFE81F` | **Reserved for the live/active state and the primary CTA only** |
| `hoth` | `#EEFBFF` | Primary text on dark |

**Color strategy: Committed.** Deep Space navy owns the whole surface as fields,
not accents. Naboo gold is rationed: the "live this Sunday" status and the
Discord CTA, nowhere else. Secondary text is `hoth/70`, never gray.

## Type

One typeface — **Hubot Sans** (Extra Bold 800 / Medium 500). No second face.

- **Labels / kickers:** Extra Bold, uppercase, tracked `+0.12em`, `blue-milk` —
  the broadcast grammar that names every section (MATCHDAY, THE SQUAD, THE
  TABLE, LATEST). This is the form's system, not a decorative eyebrow.
- **Display:** Extra Bold, tight tracking (`-0.03em`), up to ~5.5rem.
- **Data (times, ranks, points):** `font-variant-numeric: tabular-nums` — legit
  measurement use, not monospace-as-costume.

## Structure & material

- **Broadcast rectangles:** sharp corners (radius ≤ 4px), 1px `blue-milk/15`
  hairlines. No soft-shadowed rounded SaaS cards. Depth comes from the
  panel/recess tonal step, not big blurs.
- **Plain fields, no texture:** Deep Space is left as a clean field. No tiled
  grid/line overlays — structure comes from the fixture panel and hairlines.
- **Status tag:** gold pill + pulsing dot for the live fixture. The one place
  gold appears besides the CTA.

## Motion

One authored moment: the hero fixture graphic **rises in like a broadcast
lower-third** on load — a short staggered translate+fade, exponential ease-out,
from an already-visible default, gated by `prefers-reduced-motion`. Not repeated
per section. Hover states are quiet (hairline/gold shifts).

## Honesty constraints (from PRODUCT.md)

- **No fabricated standings.** The table renders a truthful *Season 01 opening*
  state — real members, points `—`, captioned that live standings sync from
  melee.gg. Never invent points or players.
- **PII:** never render more than a display name for any melee-sourced player.
- Real metrics only (reach, sponsors); YouTube content is fetched live.
