// One-time launch backfill: pay tournament history to accounts linked before
// the prize wall existed. Safe to re-run; reconciliation is idempotent. Run:
//   npx sst shell --stage production -- node scripts/backfill-linked.ts
import { linkedIdentityMap } from "../src/lib/accounts.ts";
import { reconcilePlacementCredits } from "../src/lib/ledger.ts";

const linked = await linkedIdentityMap();
const credited = await reconcilePlacementCredits(linked);
console.log(`${linked.size} linked account(s), ${credited} placement credit(s) written`);
