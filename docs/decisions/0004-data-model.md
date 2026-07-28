# ADR 0004: Data model

Date: 2026-07-28 · Status: Proposed

## Context

The leaderboard and prize wall need persistent data. ADR 0001 picked DynamoDB but deliberately deferred the schema. Four decisions now fix its shape:

1. **Ranking points and spendable currency are separate.** Redeeming a prize never changes competitive standing.
2. **The leaderboard runs in seasons**, with archived final standings.
3. **Top 8 earn placement points; everyone who finishes earns participation points.**
4. **The full Google Sheets history gets imported**, including events that predate melee.gg integration.

## Storage

A handful of purpose-shaped DynamoDB tables with **on-demand billing** — not strict single-table design.

Single-table modeling exists to conserve provisioned capacity and support high-scale access patterns; neither applies here. The whole dataset is on the order of thousands of items (roughly 50 events a year, tens of players each), and on-demand pricing at this traffic costs cents per month while genuinely scaling to zero. Readability wins over free-tier purity.

The leaderboard is computed by reading a season's rows and sorting in memory. At a few hundred players per season that is one query and a sort — no index gymnastics.

## Entities

### Identity

**Player** — a person, independent of any login.
`playerId` (ULID) · `displayName` · `discordUserId?` · `createdAt` · `status`

A Player exists as soon as they appear in an import, long before they ever sign in. Discord linking is a later, optional step. This is what keeps historical results attributable to people who have never visited the site.

**PlayerAlias** — every name a player has appeared under.
`alias` (PK, normalized) · `playerId` · `source` (`melee` | `sheet` | `manual`) · `verified` · `linkedAt`

The hard problem in this system is that the Google Sheet keys players by display name, melee.gg may use different usernames, and Discord adds a third identity. Aliases make that mapping explicit and auditable rather than guessed at import time. An unrecognized alias never silently creates points — it lands in the review queue.

### Competition

**Season** — `seasonId` · `name` · `startsAt` · `endsAt` · `status` (`upcoming` | `active` | `archived`)

**Tournament** — `tournamentId` (ULID) · `externalId` · `source` (`melee` | `csv` | `manual`) · `name` · `completedAt` · `seasonId` · `playerCount` · `scoringVersion` · `status`

`externalId` is the idempotency key: importing the same melee.gg tournament twice is a no-op.

**Placement** — one row per player per tournament.
`tournamentId` + `playerId` (composite key) · `finishRank` · `rankingPointsAwarded` · `currencyPointsAwarded` · `recordWins` · `recordLosses`

Awarded points are **stored, not recomputed**. When the scoring table changes, history stays as it was actually awarded; `scoringVersion` on the tournament records which rules applied.

### Points

**PointsLedger** — append-only, the audit trail for both currencies.
`entryId` (ULID) · `playerId` · `seasonId` · `kind` · `rankingDelta` · `currencyDelta` · `refType` · `refId` · `createdAt` · `note`

`kind` ∈ `placement` | `participation` | `redemption` | `adjustment` | `import_opening`.

One ledger with two delta columns, rather than two ledgers, because every event moves both totals together and they should never disagree. A redemption is simply `rankingDelta: 0, currencyDelta: -cost`.

**PlayerSeasonTotals** — aggregate for fast leaderboard reads.
`seasonId` + `playerId` · `rankingPoints` · `tournamentsPlayed` · `bestFinish`

**PlayerBalance** — aggregate for spendable currency, cross-season.
`playerId` · `currencyBalance` · `lifetimeEarned` · `lifetimeSpent`

Ranking points reset each season; **currency does not** — it accumulates until spent. Aggregates are always written in the same transaction as the ledger entry, so they are derived data that can be rebuilt from the ledger if they ever drift.

### Prize wall

**Prize** — `prizeId` · `name` · `description` · `imageUrl` · `cost` · `stock` · `status` (`active` | `hidden` | `sold_out`)

**Redemption** — `redemptionId` (ULID) · `playerId` · `prizeId` · `costAtRedemption` · `status` (`pending` | `fulfilled` | `cancelled`) · `requestedAt` · `fulfilledAt` · `note`

`costAtRedemption` snapshots the price, so repricing a prize never rewrites what someone actually paid.

A redemption is a single `TransactWriteItems`:
1. Decrement `PlayerBalance.currencyBalance`, conditional on `currencyBalance >= cost`
2. Decrement `Prize.stock`, conditional on `stock > 0`
3. Put the `Redemption`
4. Append the `PointsLedger` entry

Either all four land or none do, which is what makes two people racing for the last item safe.

### Import audit

**ImportRun** — `importId` · `source` · `externalId` · `status` · `tournamentsImported` · `placementsImported` · `unmatchedAliases[]` · `createdAt` · `error?`

Every import, manual or scheduled, leaves a record. Unmatched aliases are surfaced to the admin rather than resolved by guesswork.

## Scoring configuration

Scoring lives in versioned code (`website/src/lib/scoring.ts`), not a table — it changes rarely and benefits from review:

```ts
export const SCORING_V1 = {
  version: 1,
  placement: { 1: {...}, 2: {...}, /* … through 8 */ },
  participation: { ranking: …, currency: … },
};
```

Each entry carries both a `ranking` and a `currency` value, so the two economies are tuned independently. **The actual point values are still open** — see below.

## Open questions

- **Point values.** What does 1st through 8th earn, and what does finishing earn? Current Sheets values are the obvious starting point.
- **Season boundaries.** Calendar quarters, or aligned to SWU set releases?
- **Participation threshold.** Does dropping after round 2 still earn participation points, or is completing all four rounds required?
- **melee.gg player IDs.** Whether the API returns stable per-player identifiers determines how much alias matching stays manual. Unknown until the API is explored.

## Consequences

- Rebuildable state: aggregates derive from the ledger, so a bug in totals is repairable without data loss.
- Import safety: `externalId` plus stored awarded points make re-imports idempotent and history immutable.
- The cost of separating ranking from currency is two totals to keep in sync; the transaction boundary and rebuild path cover that.
- Seasons add a dimension to most queries, but archived seasons become cheap read-only history.
