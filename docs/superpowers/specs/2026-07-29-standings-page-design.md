# Full Standings Page

**Date:** 2026-07-29
**Status:** Approved

## What

A full-length season standings page at `/standings`, navigated from the home
page's Board section the same way the prize wall section links out to
`/prizes`. Shows every ranked player, not the home page's top 10, with a
season switcher covering all seasons plus all-time.

## Why

The home board deliberately truncates at 10 rows so it doesn't dwarf the rest
of the page. Players outside the top 10 (roughly 40 of ~50 each season) have
no way to see their standing. The data layer already computes the full list;
this page just shows it.

## Route and data

- New route: `website/src/app/standings/page.tsx`, a server component.
- Season selected via `?season=` searchParam. Valid values: any id in
  `SEASONS` (`s1`, `s2`, `s3`) or `all-time`. Missing param defaults to
  `CURRENT_SEASON.id`. Any other value 404s via `notFound()`, validated with
  the existing `getSeason()` before touching the database.
- Data comes from the existing `getLeaderboard(seasonId)` in `src/lib/db.ts`.
  **No data-layer changes.**
- Reading searchParams makes the route dynamic: rendered per request, ~30
  small DynamoDB queries per view. At this site's traffic that is free-tier
  noise. `/standings/[season]` with static generation was considered and
  rejected: more structure for no visible benefit.

## Page structure

- Same chrome as `/prizes`: logo linking home, Discord button, footer,
  `StoreStyles`. The page lives in "The Local" store world.
- Season switcher: plain links (`/standings?season=…`) for Season 1, Season
  2, Season 3, All-time, with the active one visually distinct. Rendered
  above the board. New seasons appear automatically since tabs derive from
  `SEASONS`.
- The board: the home page's whiteboard treatment at full length. Columns:
  `#`, `Player`, `Nights`, `Best`, `Pts`.
  - `Best` is the player's best placement for the scope, formatted as an
    ordinal (`1st`, `3rd`, `13th`) from `LeaderboardEntry.bestFinish`.
    Chosen over season W-L record because bestFinish is already computed and
    is the actual points tiebreaker, so the column makes the sort order
    legible. Record would be a new aggregation explaining nothing about rank.
- Empty scope (current season before its first Sunday) reuses the home
  board's "No results yet this season" line.
- Visual design of the page (how tabs and the full board read as physical
  objects in the store world) is handled in an `/impeccable` pass during
  implementation, not prescribed here.

## Home page change

One addition to the Board section in `src/app/page.tsx`: a
"See the whole board ↗" link to `/standings`, mirroring the prize wall
section's link to `/prizes`.

## Errors

- Unknown `?season=` value: `notFound()`.
- `getLeaderboard` throwing (missing resource bindings, Dynamo failure) is
  left to throw, same reasoning as the home page: standings that silently
  render empty are a lie.

## Testing

Scoring, season resolution, and aggregation are already covered by the
existing `node --test` suite. The page itself is presentational. The ordinal
formatter uses `Intl.PluralRules("en", { type: "ordinal" })` — the stdlib
handles the 11th/12th/13th edge cases — and stays inline in the page; no new
tests.

## Out of scope

- Per-player pages or linking rows to player detail.
- Season W-L records on the board.
- Any leaderboard aggregate table or data-layer change.
- Nav changes beyond the one Board-section link.
