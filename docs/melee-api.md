# melee.gg API

Findings from reading the spec and making three read-only calls against the live API on 2026-07-28.

- **Spec:** `docs/reference/melee-openapi.json` (Swagger 2.0, version `v0.3.64.64`)
- **Spec URL:** `https://melee.gg/swagger/docs/<version>` — publicly readable, no auth. The version is embedded in the Swagger UI page at `https://melee.gg/swagger/ui/index`; grep that page's source for `swagger/docs/` to find the current one when it changes.
- **Tournament inventory:** `docs/reference/melee-tournaments.json` (IDs, names, dates — deliberately no player data)

## Authentication

**HTTP Basic**, not OAuth. The issued client ID and secret are used directly as username and password:

```
curl -u "$MELEE_CLIENT_ID:$MELEE_CLIENT_SECRET" "https://melee.gg/api/tournament/list"
```

Access is per-user: the credentials see exactly the tournaments that user can see on the site. A `403` means the account lacks permission for that tournament rather than that the credentials are wrong.

## Endpoints that matter

| Endpoint | Use |
|---|---|
| `GET /api/tournament/list` | Discover tournaments (paginated). Returns everything the account can see. |
| `GET /api/tournament/{id}` | Tournament detail |
| `GET /api/standing/list/current/{id}` | **Final standings — the core of the importer** |
| `GET /api/standing/list/round/{id}` | Standings at a specific round |
| `GET /api/player/list/{id}` | Players in a tournament |
| `GET /api/match/list/{id}` | Matches, if per-round detail is ever wanted |

There are no webhooks. Polling is the only option, which is why the sync is a weekly cron.

## Poking at it

`website/scripts/melee-dryrun.ts` is a read-only probe that writes nothing. It
prints only the fields the importer keeps, so its output is safe to paste
anywhere. Run from `website/`:

```
node --env-file=.env.local scripts/melee-dryrun.ts            # list Online Locals
node --env-file=.env.local scripts/melee-dryrun.ts 445226     # one event's standings
```

## Response envelope

Every list endpoint returns the same wrapper:

```json
{
  "StatusCode": 200, "IgnoreCache": false,
  "Page": 1, "PageSize": 10,
  "RecordsFiltered": 10, "RecordsTotal": 20, "HasMore": true,
  "Content": [ ... ]
}
```

Pagination is via query params `variables.page`, `variables.pageSize` (minimum 5; 50 worked fine), and `variables.ignoreCache`. **Leave `ignoreCache` at its default of `false`** — melee caches server-side, and honoring that cache is the cheapest way to respect their load guidance.

The spec types every response as a generic `ApiResult`, so field shapes below come from live responses, not the spec.

## Tournament shape

Relevant fields: `ID` (integer, stable), `Guid`, `Name`, `Status` / `StatusDescription` (`Ended`, `Registration`, `Canceled`), `LastPairDateTime`, `Game` (`StarWarsUnlimited`), `OrganizationId` / `OrganizationName`, and `Phases[]` each containing `Rounds[]`.

**Only some tournaments count toward the leaderboard.** The account also sees Patreon Tournaments, Sealed and Draft events, Online Showdowns, and GC Drafts. Online Locals follow the name pattern `BMG Online Local #<n>`, and the importer must filter on that rather than importing everything. Match on the pattern, and only import tournaments whose status is `Ended`.

## Standings shape

Each row is a **team**, with players nested inside — singles events have exactly one player per team, but the array must still be handled.

Competitive fields: `Rank` (finishing position — this drives point awards), `MatchWins` / `MatchLosses` / `MatchDraws`, `GameWins` / `GameLosses`, `MatchRecord` (`"4-0-0"`), `GameRecord` (`"8-3-0"`), `Points`, `RoundNumber`, `StandingsPublished`.

> `Points` here is **Swiss match points** (12 for a 4–0), not Blue Milk Gaming leaderboard points. Do not confuse the two.

Player fields, per `Team.Players[]`:

| Field | Notes |
|---|---|
| `ID` | **Per-tournament registration ID. NOT a player ID.** See below. |
| `Username`, `DisplayName` | What the leaderboard should show |
| `DiscordUsername` | Present for most players — see below |
| `FirstName`, `LastName`, `Name` | Real name — PII |
| `DciNumber`, `ArenaScreenName`, `MtgoScreenName`, `AsmoConnectId` | External identifiers — PII |
| `PronounsDescription` | Sensitive personal data |

## Player identity: use `UserIdentity`, nothing else

Verified against live data on 2026-07-29. An earlier version of this doc claimed the `ID` on a standings row was a stable player ID. **It is not**, and building on that produced a leaderboard where every player was a stranger each week.

| Candidate | Stable across tournaments? |
|---|---|
| `Team.Players[].ID` | **No.** A per-tournament registration ID. Across the 27 Online Locals, 407 entries produced 407 distinct IDs for 149 distinct people. |
| `TeamId` | No. Also per-tournament. |
| `GemPlayerId` | Always null (0 of 69 sampled rows populated). |
| `Username` | Stable in practice, but **melee lets players change it every 28 days**, so it cannot be an anchor. |
| `UserIdentity` | **Yes. This is the anchor.** An account-level UUID. |

Evidence: `RCR_Jack1best` appears as registration `4198700` in one event and `4116501` in another, with `UserIdentity` `20bddd06-…` in both. Across 7 tournaments and 99 entries: 0 null, 71 usernames to 71 identities, no username mapping to two identities.

**`UserIdentity` is not in the standings payload.** It comes from `GET /api/player/list/{tournamentId}`, which returns one row per entrant including `UserIdentity` and the registration `ID`. So importing one tournament is two calls: fetch standings, fetch the entrant list, join on registration ID.

Never fall back to the registration ID when the join misses — that silently manufactures a new player every week. Fail the import instead.

> `/api/player/list/` is much leakier than standings: it also carries `Email`, `WizardsAccountEmail`, `PlayerName`, `Bio`, and social handles. Take only `ID`, `UserIdentity`, and the display name.

## Privacy: this endpoint returns real PII

Standings responses include players' **real names, Discord usernames, DCI numbers, and pronouns**. Melee's own API terms flag this ("potential access to PII from those organizations"), and it is the single most important constraint on the importer.

Rules:

- **Store only what the product needs**: melee player `ID`, display name, and the competitive result. Drop real names, DCI numbers, Arena/MTGO handles, and pronouns at the ingest boundary rather than persisting and filtering later.
- **Never render** anything beyond display name publicly. Note that plenty of players set `DisplayName` to their real name, and that is fine to publish: it is the name they chose to compete under. The rule is about the *field*, not the value. `DisplayName` is public; `FirstName` / `LastName` / `Name` are never stored or shown, even when they hold the same string.
- **Never commit raw API responses** to the repo. `docs/reference/melee-tournaments.json` is safe because it contains no player data; standings payloads are not.
- Log responses carefully — a debug dump of a standings payload is a PII leak.

## Discord linking

`DiscordUsername` on the player record makes the account-linking problem far easier than assumed in [ADR 0004](decisions/0004-data-model.md). When someone signs in with Discord, their username can be matched against imported players to *suggest* a link.

It must remain a suggestion, not an automatic merge: Discord usernames are mutable and not unique over time, and the value melee holds is whatever the player typed at registration. Auth.js provides the immutable Discord user ID (a snowflake) at login — store **that** as the durable link once confirmed, and treat `DiscordUsername` purely as the matching hint.

## Rate limiting

Melee asks that the API not be polled constantly and warns that excessive requests can get credentials revoked. Concretely:

- One scheduled sync per week, Monday, after Sunday's event.
- Fetch known tournament IDs directly; avoid repeatedly scanning `/api/tournament/list`.
- Persist results on first import so nothing is re-fetched to serve a page.
- Historical backfill is a manually triggered one-time job, sequential with delays between requests, never on the cron.
- Back off on failure instead of retrying tightly.
