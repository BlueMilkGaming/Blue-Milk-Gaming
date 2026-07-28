# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (serve first): existing community.** Discord regulars and Online Local
players who already know Blue Milk Gaming — they come to check leaderboard
standings, tournament info, and the latest content. Their needs win when needs
conflict.

**Secondary (serve legibly): prospective newcomers.** SWU players who don't yet
know the org. Deliberately not the launch priority — SWU is a small game, so
raw discovery is expected to be low until the game and/or Blue Milk Gaming grow.
Every page must still make sense to a first-time visitor who lands cold, so the
site scales into a growth surface without a rebuild.

The audience is genuinely both; the community-first ordering is a sizing call
about today's addressable pool, not a decision to ignore newcomers.

## Product Purpose

The official home of Blue Milk Gaming: a Star Wars: Unlimited (SWU) content org,
formed October 2025. The site ties the org's scattered surfaces (YouTube,
Discord, Patreon, the Fourthwall shop, melee.gg tournaments) into one credible
hub, and — the stated main reason it exists — automates the leaderboard that is
tracked by hand in Google Sheets today.

Success means, together:
- **Automate the leaderboard** — self-updating standings sourced from melee.gg,
  replacing the manual Google Sheets.
- **Central hub / credibility** — one legitimate home that makes the org look
  real and established.
- **Drive tournament turnout** — more players into the weekly Sunday Online Local.
- **Grow the community** — YouTube subs, Discord members, Patreon supporters over
  time, even while discovery is slow.

## Positioning

A creator-run SWU org whose weekly, recurring **Online Local** (Sunday nights, on
melee.gg) and its point-scored leaderboard + prize wall give the community a
persistent competitive season to belong to — not one-off events. The website is
the only place that home, its standings, and its content live together.

## Operating Context

- **Online Local:** weekly online tournament, Sunday nights — four rounds of SWU,
  regular Swiss, run on [melee.gg](https://melee.gg).
- **Content cadence:** weekly YouTube videos plus regular weekday lunchtime live
  streams.
- **Leaderboard & prize wall:** points awarded to top Online Local finishers;
  players redeem accumulated points for prizes. Tracked manually in Google Sheets
  today.
- **Surfaces the site connects:** YouTube (@BlueMilkGaming), Discord, Patreon,
  the Fourthwall merch store, and melee.gg tournament data.

## Capabilities and Constraints

- **Leaderboard** is imported from the melee.gg API (stable player IDs, weekly
  cron). Google Sheets exports are a reconciliation reference only, never an
  import path.
- **PII constraint (hard):** melee.gg standings responses contain real names,
  Discord usernames, DCI numbers, and pronouns. Drop everything except melee
  player ID, display name, and result at the ingest boundary; never log, commit,
  or render more than a display name publicly.
- **Prize wall** lets players redeem points for prizes (later phase).
- **Online Premier Pods (planned):** ad-hoc, 8-person tournaments facilitated
  through the website itself. Positioned as the primary newcomer on-ramp — the
  feature expected to bring in new people, distinct from the Online Local's
  existing regulars. Mechanics and scheduling still to be designed; future work
  must leave room for it.
- **Cost discipline:** everything must be free-tier / scale-to-zero.
- **Domain:** `bluemilkgaming.com` (DNS at Cloudflare) currently serves the
  Fourthwall store; the site takes the apex and the store moves to `shop.` once
  the store works there. Until cutover, the site is only at its CloudFront URL.
- **Naming:** "Blue Milk Gaming" spelled out in all outward-facing copy; never the
  bare "BMG" acronym publicly.

## Brand Commitments

- **Name:** Blue Milk Gaming (BMG internally only).
- **Members (the roster):** Alex Krezminski (alexkrez), Carlos Apodaca (Carlos A),
  Micah Overley (Overley28), Nick Obee (Tacster).
- **Palette (fixed):** Deep Space `#000342` (background), Blue Milk `#3BB0FF`
  (primary accent), Naboo `#FFE81F` (highlight, sparingly), Hoth `#EEFBFF`
  (body text on dark). See `docs/brand.md`.
- **Typography (fixed):** Hubot Sans — Extra Bold (800) for headings/wordmark,
  Medium (500) for body.
- **Logos:** canonical sets in `assets/brand/`; web copies in
  `website/public/brand/`. Use PNG lockups (wordmark SVGs render broken); the
  icon SVG is safe. Star Wars: Unlimited is the game played, not a brand the org
  owns.

## Evidence on Hand

- **Reach (as of 2026-07-28):** 686 YouTube subscribers, 554 Discord members,
  35 paid Patreon members. These are real; do not inflate or invent metrics.
- **Sponsors (real):** Premier Games (premium SWU tokens), FontAwesome (provided
  a streaming laptop).
- **Content & data:** live YouTube channel (RSS available, no API key needed),
  historical Online Local results in melee.gg + legacy Google Sheets.
- **Do not fabricate:** testimonials, player counts, prize values, or standings.
  Standings must come from melee.gg data, not placeholder names.

## Product Principles

1. **Serve the regulars first, but never lock the door.** Default to what a
   returning community member needs; keep every page legible to a cold newcomer
   so the site grows without a rebuild.
2. **The leaderboard is the reason.** Automating standings is the core job; the
   hub and content exist around it, not instead of it.
3. **Real data or nothing.** Standings, reach, and sponsors are truthful; never
   render invented players or metrics. Public rendering never exceeds a display
   name (PII boundary).
4. **One credible home.** Consolidate scattered surfaces into a place that makes
   a small-but-real org look established.
5. **Free-tier by construction.** Every capability must scale to zero.
