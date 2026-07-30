# Prize Wall Pricing

**Date:** 2026-07-29
**Status:** Approved

## What

Point prices for the prize wall, replacing the numbers in the old Google Doc.
This is a pricing policy, not a feature: the only eventual code touch is
putting real prices into `/prizes` (today a teaser stub in
`src/data/season.ts`) whenever the wall goes live on-site.

## The model this prices against

Grounded in the backfilled data (27 Locals, 407 placements, 149 players) plus
the approved pods design (`2026-07-29-online-premier-pods-design.md`):

- Sundays issue 1,500 currency/week across the top 8. A median regular earns
  roughly 100 per night attended; the all-time top earner has 4,100 lifetime,
  second place 1,800, and only 5 players have ever crossed 1,500.
- Pods add 25/win, best 2 pods/day. A dabbling regular adds ~200-400/month.
- **Prices assume the pods world**: a median regular earns ~600/month,
  ~1,500/season (seasons run ~9-11 Sundays). Pre-pods the wall is slower;
  that is accepted and builds anticipation.

Decisions fixed with the owner:

| Question | Decision |
|---|---|
| Starting balances | **Full history counts** — all backfilled currency is spendable, minus past Discord redemptions |
| Target feel | **Small win monthly, big goal per season** for a median regular |
| Budget | **~$150-250/month** retail value shipped |
| Supply | Mostly restockable, wide bench of addable items (promos, sleeves, etc.) |

## The ladder

| Points | Item | Notes |
|---|---|---|
| 3,000 | **Vault: Premier Games metal token set** ($95) | One trophy item at a time. Hand-set round number; the formula lands at ~3,175 |
| 1,500 | Regional playmats (Talzin, Sneaking Suspicion, Shien Flurry, Tyrannus) | Unchanged from the old wall |
| 1,000 | Leia playmat | Unchanged |
| 275-575 | Premier Games catalog (18 items) | Formula-priced: base retail / 3¢, rounded to 25. $8 singles at 275 up to the $17 streaming token at 575 |
| 250-350 | Promo cards (owner's existing stock) | **Deferred at launch.** Price each at ~3¢/pt of rough retail when added |
| 200 | Sleeves | **Deferred at launch** |
| 100 | OP pack (random set, not current) | **Deferred at launch.** Sourced at ~$1.43/unit (box of 70); feels fair at perceived value, costs far less |

The wall launches with the trophy, the playmats, and the Premier Games
tokens only: a deliberately sponsor-plus-playmats start. The deferred rungs
keep their prices for when they go up.

The old wall's top shelf was accidentally correct for the pods world and is
kept for continuity (those prices were published). The two real fixes are
raising the pack from 50 (two pod wins = a pack was a budget leak) and
filling the empty 50-500 middle, which was what actually made the wall feel
like a mountain.

## Guardrails

- **Catalog items are priced at 3¢ of retail per point.** This is the entire
  budget mechanism: with no arbitrage rung, exposure is capped by points
  issued (~10k/month in the pods world → $300/month of retail at full
  redemption, far less in practice, before the sponsor's $50). Own-stock
  entry rungs (pack, sleeves) are deliberately worse per point, so saving up
  is always the better deal.
- **Prices are multiples of 25** (one pod win) and the entry rung stays at or
  above 100 (the smallest Sunday award), so no award rounds to nothing.
- **Sponsor coverage never lowers point prices.** If a sponsor covers an
  item's cost, that widens budget headroom or funds the vault; discounting
  the item in points would break the ladder's feel.
- **Small items ship batched.** The pack rung will be the most-redeemed item
  and per-envelope mailing is the real cost. Small redemptions accumulate and
  ship together with the player's next redemption (or in lots), at the
  owner's discretion.

## Day one

Five players can afford 1,500+ immediately; only the top earner can take the
vault item. Expected one-time cost is a few playmats to the most loyal
players, which is what the points were for. No mitigation.

## Open before publishing

None. (Resolved: OP pack sourced at ~$1.43/unit, priced at 100. Sponsor:
Premier Games contributes $50/month toward prizing, which covers the vault
item roughly every two months; per the guardrail this changes budget
headroom, never point prices.)

## Catalog

The full wall lives in `website/src/data/prize-wall.ts`: the ladder above
plus 16 Premier Games catalog items priced by the formula, with retail,
image URL, and product URL pulled from their Shopify catalog. At 3¢/pt the
$15 tokens land at 500, matching the old published wall, so the repricing
reads as continuity. Excluded from the catalog: the $105-170 Streaming
Metal Token Set (a future vault rotation candidate), the two storage cases
(accessories to products players may not own), the trays/holder (bloat at
the bottom of the wall), and the Streaming Metal Advantage Token (a lone
streamer-line item with no siblings on the wall).

## Out of scope

- Building the on-site wall UI or redemption flow (redemption stays manual
  via Discord).
- Retuning the pod win value (stays 25 per the pods design).
- Any change to Sunday scoring.
