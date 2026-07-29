// Manual melee.gg import. The weekly cron runs the same loop; this is for
// backfills and for re-importing a specific event.
//
// Needs SST resource bindings, so run it through `sst shell`:
//
//   npx sst shell --stage production -- node --env-file=.env.local scripts/melee-import.ts
//   npx sst shell --stage production -- node --env-file=.env.local scripts/melee-import.ts --force 445226
//
// Already-imported tournaments are skipped unless --force is passed.

import { syncTournaments } from "../src/lib/sync.ts";

const args = process.argv.slice(2);
const result = await syncTournaments({
  force: args.includes("--force"),
  only: args.filter((a) => !a.startsWith("--")).map(Number),
});

// Non-zero exit so a failed backfill is visible to whatever ran it.
if (result.failed.length > 0) process.exit(1);
