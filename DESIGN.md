# Design

<!-- impeccable:design-schema 1 -->

## World: The Local

Blue Milk Gaming's site is a **local game store, virtual**. The Online Local is
a game store's weekly night moved online, so the site is the store itself: the
page ground is the store wall in Deep Space navy, and everything on it is a
physical artifact. The event flyer with tear-off tabs, the pinned crew photo,
name tags for the regulars, the standings whiteboard, videos as stock on shelf
rails, partner stickers on the glass, the head-count index card. This refuses
both the dark-neon esports org page and any borrowed metaphor from outside the
hobby; the room is the community's own.

## Palette (the store's materials)

Brand tokens are fixed (see `docs/brand.md`); this world maps them onto
materials, not UI roles.

| Token | Hex | Material |
|---|---|---|
| `wall` | `#000342` | The store wall, the page ground |
| `wall-deep` | `#00021C` | Deeper recesses: footer, taken tab, sticker panels |
| `paper` | `#EEFBFF` | Every paper artifact; also text directly on the wall |
| `board` | `#F8FDFF` | The whiteboard, one step brighter than paper |
| `ink` | `#000342` | Navy ink on paper (same hex as the wall, flipped role) |
| `accent` | `#3BB0FF` | Translucent tape, links, hover; never a fill for its own sake |
| `hot` | `#FFE81F` | **Rationed: the "this Sunday" highlight and the Discord sticker/CTA only** |

**Color strategy: Committed.** Navy owns the surface as one continuous wall;
light enters as paper artifacts, not as panels. Artifacts are paper-white with
navy ink, the exact inversion of the wall. Secondary text is tinted via
`color-mix` from `paper` or `ink`; never gray.

## Type

One typeface, **Hubot Sans** (Extra Bold 800 / Medium 500). No second face.

- **Display:** Extra Bold, uppercase, tight (`-0.03em`), line-height 0.9. Ink
  on paper, at flyer scale.
- **Tape labels:** Extra Bold, uppercase, tracked `+0.18em`, small. Always
  paper-white on a translucent accent strip (ink fails contrast on tape over
  the wall). Tape is the section-label system.
- **Data** (dates, points, counts): `font-variant-numeric: tabular-nums`.

## Structure & material

- **Artifacts, not cards.** Every content block is a nameable physical object
  from a game store. If a block can't be named as an object (flyer, tag, board,
  box, sticker, index card), it doesn't belong in this world.
- **Tape holds things up.** Corner tape pieces (`.taped`) or a label strip
  (`.tape`), in translucent Blue Milk.
- **Tilt discipline:** slight rotations only (−1° to +1.2°), from a small fixed
  set; artifacts straighten or lift on hover. Never large drunken angles.
- **Depth is an offset shadow** (`0 14px 34px -16px` navy), paper lifted off a
  wall. No glows, no borders-as-depth.
- **No texture packs:** no wood grain, cork, or paper-grain images. Materials
  are implied by color, shadow, and behavior only.

## Motion

One authored moment: pinned artifacts in the first viewport **settle onto the
wall** on load (drop + slight over-rotation to their resting tilt, exponential
ease-out, staggered, visible-by-default via `backwards` fill). Gated by
`prefers-reduced-motion`. Elsewhere: quiet hovers only (lift, straighten, tab
pull-down).

## Honesty constraints (from PRODUCT.md)

- **No fabricated standings.** The whiteboard renders the truthful Season 01
  opening state: real members, points `—`, captioned that live standings sync
  from melee.gg. Never invent points or players.
- **PII:** never render more than a display name for any melee-sourced player.
- Real metrics only (head count, sponsors); YouTube stock is fetched live.
- Copy speaks the store's language (regulars, the board, fresh stock, the back
  room) but never invents inventory, prices, or a physical address.
