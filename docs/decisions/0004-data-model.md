# ADR 0004: Data model

Date: 2026-07-28 · Status: Accepted

## Context

The leaderboard and prize wall need persistent data. ADR 0001 picked DynamoDB but deliberately deferred the schema. These decisions fix its shape:

1. **Ranking points and spendable currency are separate.** Redeeming a prize never changes competitive standing. Ranking is always "total points earned in the season" — currency totals never affect standings.
2. **The leaderboard runs in seasons**, aligned to SWU set releases, with archived final standings. Three views are required: **current season**, **any past season**, and **all-time cumulative**.
3. **Only the top 8 earn points**, by placement. Participation points are deferred — the model supports them, but nothing awards them yet.
4. **History gets imported.** Preferably backfilled from melee.gg rather than the Google Sheets aggregates; see [legacy data analysis](../legacy-leaderboard-data.md).
5. **Currency never expires.** Ranking resets each season; earned currency accumulates until spent.

## Scoring

| Placement | Points |
|---|---|
| 1st | 400 |
| 2nd | 300 |
| 3rd–4th | 200 each |
| 5th–8th | 100 each |
| 9th and below | 0 |

1,500 points per event. Historically these were recorded as packs at 100 points per pack (4/3/2/2/1/1/1/1) — the same economics.

When participation points are introduced, dropping mid-event will not earn them; finishing all rounds is required.

## Seasons

Boundaries follow SWU set releases, and event counts per season vary — nothing may assume a fixed length.

| Season | Set | Events |
|---|---|---|
| 1 | 6 (SEC) | Online Local #1–9 |
| 2 | 7 (LAW) | Online Local #10–20 |
| 3 (current) | 8 (ASH) | Online Local #21–present |

SWU's release cadence is changing, so season boundaries must be editable data rather than anything derived or hardcoded.

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

The all-time cumulative leaderboard sums these across seasons rather than maintaining a fourth aggregate. At roughly 80 players and a handful of seasons that is a few hundred rows — cheap, and it cannot drift from the per-season numbers.

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
  placement: {
    1: { ranking: 400, currency: 400 },
    2: { ranking: 300, currency: 300 },
    3: { ranking: 200, currency: 200 },
    4: { ranking: 200, currency: 200 },
    5: { ranking: 100, currency: 100 },
    6: { ranking: 100, currency: 100 },
    7: { ranking: 100, currency: 100 },
    8: { ranking: 100, currency: 100 },
  },
  participation: null, // deferred; requires finishing all rounds when introduced
};
```

Each entry carries separate `ranking` and `currency` values even though they are currently identical, so the two economies can diverge later without a migration.

## melee.gg API constraints

The API returns stable player identifiers, so imported placements key on a real ID rather than a display name. Aliases remain necessary for reconciling historical sheet data and for showing players a name they recognize.

Melee's terms ask that the API not be polled constantly and warn that excessive requests may get credentials revoked. This shapes the design:

- One scheduled sync per week (Monday, after Sunday's event) — not a frequent poll.
- Fetch specific known tournaments rather than scanning broadly.
- Results are stored permanently on first import, so nothing is ever re-fetched for display.
- Historical backfill is a manually triggered one-time job, run sequentially with delays, never on the cron.
- Failures back off rather than retrying tightly.

## Open questions

- **Unexplained sheet totals.** Seasons 2 and 3 carry a sidebar number (`13000`, `7600`) matching neither the points sum nor events × 1,500. What are they?
- **`Vorath` vs `Voraththefallen`.** Both hold separate Season 2 totals. Same person with split points, or two people?
- **Season total discrepancies.** Season 2 and 3 each fall 400 short of events × 1,500, Season 1 runs 100 over. Ties, short events, or manual adjustments?
- **Participation point values.** Deferred until the owner decides.

## Consequences

- Rebuildable state: aggregates derive from the ledger, so a bug in totals is repairable without data loss.
- Import safety: `externalId` plus stored awarded points make re-imports idempotent and history immutable.
- The cost of separating ranking from currency is two totals to keep in sync; the transaction boundary and rebuild path cover that.
- Seasons add a dimension to most queries, but archived seasons become cheap read-only history.
