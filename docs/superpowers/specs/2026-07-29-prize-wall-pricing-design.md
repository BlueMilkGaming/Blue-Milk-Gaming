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
| Budget | **~$150-250/month** retail value shipped, ≈ the old wall's implied 4-5¢/point |
| Supply | Mostly restockable, wide bench of addable items (promos, sleeves, etc.) |

## The ladder

| Points | Item | Notes |
|---|---|---|
| 3,000 | **Vault: Premier Games metal token set** ($95) | One trophy item at a time. 3.2¢/pt, deliberately the worst deal per point |
| 1,500 | Regional playmats (Talzin, Sneaking Suspicion, Shien Flurry, Tyrannus) | Unchanged from the old wall |
| 1,000 | Leia playmat | Unchanged |
| 750 | Premier Games credit tokens x4 | Unchanged |
| 500 | Force / Twin Suns / Initiative token sets | Unchanged |
| 250-350 | Promo cards (owner's existing stock) | New middle rung; price each at ~4-5¢/pt of rough retail |
| 200 | Sleeves | New entry-month goal |
| 100 | OP pack (random set, not current) | Sourced at ~$1.43/unit (box of 70). Feels like 3-5¢/pt at perceived value, costs far less |

The old wall's top shelf was accidentally correct for the pods world and is
kept for continuity (those prices were published). The two real fixes are
raising the pack from 50 (two pod wins = a pack was a budget leak) and
filling the empty 50-500 middle, which was what actually made the wall feel
like a mountain.

## Guardrails

- **Every item sits in a 3-6¢-of-retail-per-point band.** This is the entire
  budget mechanism: with no arbitrage rung, exposure is capped by points
  issued (~10k/month in the pods world → $150-250/month worst case at full
  redemption, less in practice). The vault item may sit below the band; a
  trophy is allowed to be a bad deal.
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

1. **Sponsors:** conversation pending; outcome affects budget headroom and
   vault restocks only, not prices.

(Resolved: OP pack sourced at ~$1.43/unit, priced at 100.)

## Out of scope

- Building the on-site wall UI or redemption flow (redemption stays manual
  via Discord).
- Retuning the pod win value (stays 25 per the pods design).
- Any change to Sunday scoring.
