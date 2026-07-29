# Online Premier Pods — Design

Date: 2026-07-29 · Status: Approved (brainstorm with owner)

## Context

The site's world is the Online Local: a weekly Sunday tournament, the flyer on the door. Pods add the day-to-day verb: a player clicks **Play now**, joins (or opens) an 8-player lobby, and when it fills the site runs a 3-round mini-tournament with small prize-wall payouts per win. If the site grows, pods may become its most-used feature — the design must let that happen without dethroning the Local.

The store metaphor already contains the answer: a game store has a flyer for the weekly event *and* tables where people sit down and play. Pods are **The Tables**.

Decisions fixed with the owner during brainstorming:

| Question | Decision |
|---|---|
| Who runs the pod tournament? | **The site, end-to-end** (melee.gg's API is read-only; it cannot create events) |
| Player identity | **Discord sign-in, linked to melee identity** via claim + admin approval |
| How lobbies fill | **Discord webhook announcements** borrow the community's liquidity |
| Result reporting | **Either player reports; opponent can flag**; flags freeze that match's points only |
| Which points bucket | **Currency only** — zero ranking, the whiteboard stays the Local's season race |
| Farming control | **Best 2 pods per day earn**, settled live (see Points) |
| Lobby expiry | **60 minutes** unfilled → abandoned |

## Staging

Two projects, planned separately:

1. **Stage 1 — Identity** (Phase 4 pulled forward; independently valuable, the prize wall needs it too): Auth.js v5 + Discord OAuth with JWT sessions. A new `Account` table keys on the Discord snowflake; `Player` stays melee-keyed and untouched. A Discord-only visitor gets an Account row at first sign-in — melee history is *not* required to play.
   - **Claim flow:** signed-in player picks their melee display name from the existing player list → review queue → admin approves → approval sets `Account.meleeUserIdentity`, a pointer. Nothing is ever re-keyed or merged; pod ledger entries key on the Discord ID and Sunday results stay melee-keyed, joined through the pointer. Auto-confirmation via melee's in-memory `DiscordUsername` during the weekly cron is a noted future optimization, not in scope.
2. **Stage 2 — Pods:** everything below.

## Pod lifecycle

**One pod = one DynamoDB item** in a new `Pod` table. Eight seats and three rounds fit in a single item. In-pod mutations (reports, flags, round deals) are conditional writes on that item. Join/leave/close are a two-item `TransactWriteItems` — the pod item plus `Player.activePodId` (set on join, condition "not already set" enforces one active pod per player, cleared on leave/close). No lock table, no sweeper.

```
podId (ULID) · status: filling → playing → done | abandoned
seats: [{playerId, displayName, joinedAt}]        (max 8)
rounds: [{pairings: [{a, b, winner?, reportedBy?, flaggedBy?}]}]
createdAt · filledAt · closedAt
```

- **Join** ("Play now"): join the open `filling` pod or create one. Conditional on: seats < 8, not already seated, no `activePodId`. Losing the race for the 8th seat creates the next lobby — overflow *is* the next pod.
- **Leave** while `filling`: mirror update.
- **Fill:** 8th seat flips status to `playing` and deals round 1.
- **Expiry (lazy, checked on read):** `filling` > 60 min → `abandoned`. `playing` > 4 h → `done` as-is: reported wins pay, unreported matches pay nothing.
- **Live updates:** `/play` polls a route handler (~7 s) that reads the one item. No websockets.
- **Discord webhook** (incoming webhook, SST secret — no bot user) posts three messages per pod: lobby opened, 6/8 seats, pod launched — plus a short note if a lobby expires unfilled. Per-join spam would get the channel muted.

## Playing a pod

- **Pairings:** round 1 random; rounds 2–3 pair by record, avoiding rematches. With 8 players a round has only 105 possible pairings, so the pairer scores all of them (penalty for record mismatch, large penalty for rematch) and takes the best. Pure function: `(seats, priorRounds) → pairings`.
- **No standings, no tiebreakers.** Prizing is per-win, so no final ranking exists. No OMW%. The summary shows records (3-0, 2-1), never places.
- **Reporting:** either player taps the result on their match card. Round N+1 deals when all four results are in.
- **Disputes:** opponent may flag any result until the pod closes. The pod keeps moving on the reported result; only the flagged match's payout freezes until admin resolution (ledger adjustment either way).
- **No-shows:** 30 min into a round, either player can claim a no-show win on an unreported match; claims are flaggable like any result.
- **Play platform:** deliberately unnamed everywhere (see CLAUDE.md conventions). Copy says "coordinate in Discord, report here when done."

## Points

Builds `PointsLedger` and `PlayerBalance` from ADR 0004 (their first real consumer). Sunday placements are untouched; migrating them onto the ledger is a separate later cleanup.

- Pod close writes one `pod_win` ledger entry per unfrozen win: `currencyDelta: +X, rankingDelta: 0`, ref to pod + match. Balance updates in the same transaction.
- **X = 25** (default; one constant in `scoring.ts` as versioned `PODS_V1`). A 3-0 pod pays 75 vs 400 for winning a Sunday — five perfect pods ≈ one tournament win, so the flyer stays on top. Owner may retune before launch.
- **Best 2 pods per day, settled live:** at each pod close, compute the value of the player's best two pods today, subtract what today already paid, pay the non-negative difference. Immediate payout in the common case; a later better pod tops up; nothing is clawed back. Pure function: `(todaysPodResults, alreadyPaidToday) → delta`.
- Enforcement queries today's `pod_win` entries (a handful of items) — no counters maintained.

## UI / IA

- **Home:** new `Tables` section between the Door (flyer) and the Board. Live pod state as chairs at a table; "pull up a chair ↗" → `/play`. Empty state: "Tables are quiet right now. First pod of the day opens when you sit down." The flyer keeps the first viewport; if pods become dominant, the section moves up without breaking the store world.
- **Nav:** "The Tables" item with a Blue Milk dot when a lobby is open or a pod is running.
- **`/play`** (one route, state-driven, store-dressed): signed-out explainer + Discord sign-in → Play now + today's earning status → filling lobby (seats, leave, 60-min countdown) → playing (your match card: opponent, report, flag; other tables small; round in marker) → done (record, points paid, "sit down again").
- Display names only (PII rule). "Blue Milk Gaming" spelled out. No platform names.

## Error handling

Covered above where it lives: join races (conditional writes), 8th-seat race (loser opens next lobby), lobby expiry (60 min lazy), stuck pods (4 h lazy close, honest partial payout), disputes (per-match freeze), no-shows (30-min claim), webhook failure (announce is best-effort — a lost Discord message never blocks a pod).

## Testing

Repo convention: pure functions + `node --test`, no frameworks.

- Pairing scorer: record matching, rematch avoidance, exhaustiveness over the 105 matchings.
- State machine transitions: join/leave/fill races, expiry, flag freeze, close.
- Settle-up: including the motivating case — 0-3, 0-3, then 3-0 pays as a best pod.
- Route handlers and conditional writes exercised in dev against the real table.

## Out of scope

- Participation points; pod formats other than 8-player / 3-round Premier.
- **Private pods** (invite-only tables): deferred, a plausible later addition.
- **Ranked pods: never.** Not deferred — avoided. Pods paying ranking points would erode the whiteboard as the Local's season race, which is the core tension this design exists to prevent.
- melee.gg involvement of any kind in pods.
- Auto-confirming melee claims via `DiscordUsername`.
- Migrating Sunday placements onto the ledger.
- Scheduled pod windows (the Discord webhook is the liquidity mechanism; windows can layer on later if lobbies still fizzle).
