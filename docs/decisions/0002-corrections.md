# ADR 0002: Corrections to the V1 plan after org context landed

Date: 2026-07-28 · Status: Accepted · Amends: [0001](0001-stack.md)

## Context

The V1 plan in ADR 0001 was written before `docs/org.md` was filled in. Three assumptions turned out to be wrong or incomplete.

## Corrections

**1. The content feed is YouTube and Patreon, not Twitch.**
Blue Milk Gaming publishes weekly YouTube videos and streams on YouTube over weekday lunch hours. There is no Twitch presence. Drop the planned Twitch Helix integration entirely.

- Recent videos: the channel's public RSS feed (`https://www.youtube.com/feeds/videos.xml?channel_id=…`), fetched server-side with ISR. No API key, no quota.
- Live status: YouTube has no equivalent of Twitch's cheap "is this channel live" endpoint. The RSS feed does not mark live streams reliably. Options, deferred to Phase 2: use the YouTube Data API `search` endpoint with `eventType=live` (costs 100 quota units per call, so cache aggressively), or skip live status in V1 and simply surface the latest videos.
- Patreon: a plain outbound link in V1. No API integration.

**2. The game is Star Wars: Unlimited (a TCG), and melee.gg is the right platform for it.**
melee.gg is a tabletop/TCG tournament platform, which is consistent with the plan. No change to the importer design — noting it because "melee" reads as a fighting-game reference and is easy to misread.

**3. `bluemilkgaming.com` is already in use by the Fourthwall store.**
The original plan treated the domain as available. It currently serves the merch store, so the site launch needs a DNS decision (take the apex and move the store to `shop.`, or put the site on a subdomain). Recorded in `docs/setup.md`; not blocking, since SST deploys are reachable at a CloudFront URL until then.

## Consequences

- Phase 2 loses the Twitch widget and gains a YouTube video feed plus a decision about whether live status is worth the API quota.
- The home page roster is four members (see `docs/org.md`), small enough that a checked-in file remains the right storage for it.
