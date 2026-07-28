# Legacy leaderboard data (Google Sheets exports)

Analysis of the three season exports that the site's leaderboard replaces. The raw files sit in `data/legacy/` and are **intentionally gitignored** — they contain player real names, and git history is permanent for a repo that may eventually go public. Keep them locally; the durable home for this data is the database after import.

## What the exports actually contain

| Season | SWU set | Events | Rows | Points column sum |
|---|---|---|---|---|
| 1 | 6 (SEC) | Online Local #1–9 | 46 | 13,600 |
| 2 | 7 (LAW) | Online Local #10–20 | 39 | 16,100 |
| 3 (current) | 8 (ASH) | Online Local #21–present | 30 | 10,100 |

86 distinct names case-insensitively across all three, so roughly 80 real people once aliases are merged.

### These are season aggregates, not tournament results

**This is the single most important finding.** Each row is one player and their season point total. There is no per-event breakdown anywhere in the exports — the only trace of individual events is a list of event names in a sidebar column.

The consequence: these files alone cannot populate per-tournament `Placement` records. They can only seed one opening balance per player per season. See "Import strategy" below for what to do instead.

### Season 1 has a different shape

Season 1 has `Place` and `Total Packs Won` columns that Seasons 2 and 3 lack, and its `Place` column contains ties (seven players tied at 8th, sixteen tied at 31st).

`BMG Points == Total Packs Won × 100` holds for **every** row in Season 1. So the historical scheme was packs-per-placement, converted at 100 points per pack — the same economics as the current rule (4/3/2/2/1/1/1/1 packs → 400/300/200/200/100/100/100/100 points), just recorded in packs rather than points. Scoring has been consistent throughout; only the bookkeeping changed.

### Totals don't reconcile exactly

At 1,500 points per event under the top-8 rule:

| Season | Events | Expected | Actual | Difference |
|---|---|---|---|---|
| 1 | 9 | 13,500 | 13,600 | +100 |
| 2 | 11 | 16,500 | 16,100 | −400 |
| 3 | 7 | 10,500 | 10,100 | −400 |

Small discrepancies, consistent with events that had ties, fewer than eight finishers, or manual adjustments. Worth understanding before treating the sheet as authoritative, but not alarming.

### Unexplained sidebar numbers

Seasons 2 and 3 have a lone number in a far-right column — `13000` and `7600` respectively — that matches neither the points sum nor events × 1,500. Purpose unknown. **Open question for the owner.**

## Name and identity quirks (all confirmed in the data)

The alias design in [ADR 0004](decisions/0004-data-model.md) exists because of exactly these cases:

- **Case drift:** `RCR_jack1best` (S1) vs `RCR_Jack1best` (S2, S3). Matching must be case-insensitive.
- **Team prefix changes:** `BN_Chrispy` (S1) becomes `ECL_Chrispy` (S2). Players carry team tags that change when they switch teams — observed prefixes include `RCR_`, `CST_`, `BN_`, `MND_`, `ECL_`, `F8_`, `CBG_`. A prefix is not part of a player's identity.
- **Possible same player, two entries:** `Vorath` and `Voraththefallen` both appear in Season 2 with separate totals (600 and 400), and `Vorath` also appears in Seasons 1 and 3. If these are one person, Season 2 split their points. **Open question for the owner.**
- **Non-ASCII names:** `Viktor Edström`. Read files as UTF-8 and normalize before comparison; don't strip accents.
- **Mixed conventions:** melee handles (`th3connman23`) sit alongside real names (`Easton Daniel`, `Kyle Renfro`). Both are legitimate melee.gg display names.

No name is duplicated within a single season, so each file is internally consistent.

## Import strategy

Prefer **backfilling real tournament data from the melee.gg API** over importing these aggregates. The past Online Locals still exist on melee.gg, the API returns stable player IDs, and per-event standings give genuine history — per-tournament results pages, accurate placement counts, and identity keyed to something better than a display name. The sheet is a lossy summary of data that still exists upstream.

These CSVs then serve as **reconciliation ground truth**: import from the API, recompute season totals, and compare against the sums above. Differences point at either an import bug or a manual adjustment worth recording.

Fall back to seeding opening balances from the CSVs only for seasons the API can't reach.

Two constraints on the backfill:

- Melee.gg's terms ask that the API not be polled constantly and warn that excessive requests can get credentials revoked. A historical backfill is a bounded one-time job, not polling — but run it sequentially with delays, triggered manually, never from the weekly cron.
- Store awarded points as imported rather than recomputing them from current rules, so Season 1's pack-derived numbers stay exactly as they were awarded.
