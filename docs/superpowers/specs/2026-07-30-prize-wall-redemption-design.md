# Prize Wall Redemption — Design

Date: 2026-07-30. Status: approved.

## Context

The prize wall at `/prizes` is a display-only catalog: items, prices, and
"ping an admin in the Discord to redeem". This spec makes it transactional:
signed-in players spend their points on the wall, requests land in an admin
queue, and admins fulfil or cancel them.

Most of the machinery already exists:

- `/account` with Discord sign-in and the melee claim flow (Stage 1), plus
  the admin claims queue at `/admin/claims`.
- `PointsLedger` and `PlayerBalance` tables, live since Stage 2 (pods pay
  into them). Both key on the Discord snowflake.
- ADR 0004, which already specifies the `Prize` and `Redemption` entities
  and the four-item redemption transaction. This spec implements them.
- The prize catalog in `src/data/prize-wall.ts` (21 items, priced per the
  2026-07-29 pricing spec) and the `announce()` Discord webhook helper.

The one genuinely new piece is the currency bridge: Sunday placements store
`currencyPointsAwarded` keyed by melee identity, and nothing yet turns that
into spendable balance.

## Decisions made during brainstorming

- **Catalog in code, stock in Dynamo.** Item content (names, prices,
  images) stays in `prize-wall.ts`, edited via git; images need commits
  regardless (pre-sized PNGs, `images.unoptimized`). The admin page edits
  only stock and visibility.
- **Stock counts for owned items, unlimited for drop-ship.** Playmats and
  the trophy-tier item carry finite counts (mostly 1). Premier Games
  catalog items are ordered on demand, so they are untracked/unlimited.
- **Deduct at request.** Points and stock come off atomically when the
  player redeems; cancelling refunds. Race-safe by construction.
- **Full history at link time.** When a claim is approved, every
  `currencyPointsAwarded` the player has ever earned becomes spendable.
- **No PII.** No shipping addresses on the site; fulfilment is coordinated
  in Discord DMs, as today.
- **Private admin channel webhook, not a bot.** Webhooks cannot DM; a bot
  is heavy for a notification.
- **Static "Your Card" nav link, no session-aware header.** `auth()` in
  `SiteHeader` would force every page dynamic and kill the home page's
  prerender. `/account` handles both auth states on landing.
- **`/admin` index, not a header link.** Admins bookmark it; no reason to
  advertise the admin surface publicly.

## Data

Two new Dynamo tables, both from ADR 0004, both additive:

**`Prize`** — hash key `prizeId` (string). Fields: `stock: number`,
`hidden?: boolean`. **A row means finite stock; no row means unlimited.**
Rows are seeded from the admin page, not by deploy. `PrizeWallItem` in
`prize-wall.ts` gains `id: string` (a stable slug; also becomes the React
key), which is the `prizeId`.

**`Redemption`** — hash key `playerId` (Discord snowflake), range key
`redemptionId` (ULID). Fields: `prizeId`, `costAtRedemption`, `status`
(`pending` | `fulfilled` | `cancelled`), `requestedAt`, `fulfilledAt?`,
`note?`. `costAtRedemption` snapshots the price so repricing never rewrites
history. Player history is a partition read; the admin queue is a
full-table scan filtered to `pending` — the same dozens-scale pattern as
`accounts.ts`, with the same upgrade path (sparse GSI) if it ever grows.

`LedgerEntry.kind` widens from `"pod_win" | "adjustment"` to add
`"redemption"`, `"placement"`, and `"placement_backfill"`. `refType` widens
to add `"redemption"` and `"placement"`.

## The redemption transaction

One `TransactWriteItems`, per ADR 0004:

1. `PlayerBalance`: `currencyBalance -= cost`, `lifetimeSpent += cost`,
   conditional on `currencyBalance >= cost`.
2. `Prize`: `stock -= 1`, conditional on `stock > 0`. **Omitted entirely
   for unlimited items** (no `Prize` row).
3. Put `Redemption` with status `pending`.
4. Append `PointsLedger` entry: `kind: "redemption"`, `rankingDelta: 0`,
   `currencyDelta: -cost`, `refType: "redemption"`, `refId: redemptionId`.

After the transaction commits, fire the admin webhook (best effort, same
pattern as pods: a lost Discord message never voids a redemption).

**Fulfil** (admin): set `status: "fulfilled"`, `fulfilledAt`, conditional
on `status = pending`.

**Cancel** (admin, optional note): a transaction reversing the request —
compensating ledger entry (`currencyDelta: +cost`), balance credit, stock
increment if the item has a `Prize` row, `status: "cancelled"`, all
conditional on `status = pending`.

## The currency bridge

Two write paths, both crediting the Discord-keyed `PlayerBalance`:

**At claim approval.** `resolveClaim`'s approve path becomes a
`TransactWriteItems`: the existing `Account` update, plus one opening
ledger entry (`kind: "placement_backfill"`, `currencyDelta` = the sum of
`currencyPointsAwarded` across every placement for that melee identity,
`refType: "placement"`, `refId: meleeUserIdentity`), plus the balance
credit. A player with no placements gets no opening entry (skip a zero
credit).

**At weekly sync.** After `importTournament` writes a tournament's
placements, each placement whose melee identity maps to a linked account
gets a placement credit: ledger entry (`kind: "placement"`, `refId:
"<meleeId>#<meleeUserIdentity>"`) plus balance credit. Idempotency: the
entry uses a **deterministic `entryId`** derived from the tournament
(`plc-<meleeId>`, which still sorts stably within the partition) with a
conditional put (`attribute_not_exists(entryId)`), so a `--force` re-import
can never double-credit. If the conditional put fails, the balance credit
must not apply — each placement credit is its own small transaction.

Unlinked players lose nothing: their placements accumulate as today and
the backfill credits the full history whenever they link. The two paths
cannot double-count because backfill sums placements at approval time and
sync only credits accounts that are already linked.

## Pages

**`/prizes`** — becomes dynamic (session + stock at request time):

- Items with a `Prize` row at `stock: 0` stay visible, greyed, with a
  "claimed" tape. `hidden` items don't render.
- Signed-in, linked players see their balance and a Redeem button on each
  affordable, in-stock item. Redeem asks for one confirmation (a 1,500
  point misclick is a bad Sunday), then runs the transaction via a server
  action. The button disables on submit.
- Signed-out or unlinked visitors see the wall as today plus a "sign in to
  redeem" nudge linking to `/account`. The "ping an admin" copy goes away.

**`/account`** — gains a balance display and a redemption history list
(item, cost, status, date). Sign-in and claiming already exist.

**`/admin/prizes`** — new, allowlist-gated like claims/flags. Two
sections:

- **Queue:** pending redemptions (player display name, item, cost,
  requested date) with Fulfil and Cancel buttons; cancel takes an optional
  note.
- **Stock:** every catalog item with its count or "unlimited", an editable
  count (setting a count creates the `Prize` row; clearing it deletes the
  row, returning the item to unlimited), and a hide toggle.

**`/admin`** — new index: links to Claims, Flags, and Prizes with pending
counts beside each, so it doubles as "anything need my attention?". A small
shared `AdminNav` strip goes at the top of all three admin pages.

**Header** — `NAV` in `site-chrome.tsx` gains `{ label: "Your Card",
href: "/account" }`. Static link; no session read in the header.

## Discord

New SST secret `AdminWebhookUrl` for an incoming webhook on the private
admins channel. `discord.ts` gets a sibling of `announce()` posting there:

> **{displayName}** redeemed **{item}** for {cost} pts —
> <https://bluemilkgaming.com/admin/prizes>

No bot, no DMs, no PII beyond the Discord display name.

## Error handling

- Insufficient balance or out of stock: the transaction's condition fails;
  the server action returns a plain message ("Not enough points" /
  "Someone beat you to it") and the page re-renders with current truth.
- Double-click: the button disables on submit. If two requests race
  through anyway and the balance covers both, both land — that is a real
  double purchase, and cancel handles it.
- Fulfil/cancel race between two admins: `status = pending` conditions
  make the second action fail loudly instead of double-refunding.
- Balance can never go negative and stock can never oversell (conditions),
  and every point movement has a ledger entry, so `PlayerBalance` remains
  rebuildable from the ledger.
- Accepted race: a claim approved in the same instant the weekly sync is
  crediting that player's newly imported placement could double-credit
  that one tournament (backfill sums it and sync credits it). Weekly cron
  plus manual approvals makes this vanishingly rare; the ledger makes it
  visible, and an admin `adjustment` entry is the remedy. Not worth
  coordination machinery at club scale.

## Testing

Same `node --test` pattern as `src/lib`:

- Redemption guard logic (pure): linked, sufficient balance, stock state,
  hidden items.
- Backfill sum and the deterministic placement `entryId` derivation.
- Cancel refund math.

The transaction wiring is verified end to end in production the way pods
were: redeem, check queue + webhook + balance, cancel, verify refund,
re-redeem, fulfil.

## Out of scope

- Shipping addresses or any PII storage (Discord DMs handle fulfilment).
- A Discord bot.
- Prize catalog CRUD in the admin UI (git is the CMS).
- Session-aware header personalization.
- Leaderboard/standings changes: redemption is `rankingDelta: 0` and never
  touches competitive standing (ADR 0004 invariant).
