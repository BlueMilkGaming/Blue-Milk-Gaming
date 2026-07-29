// Import Online Local results from melee.gg into DynamoDB.
//
// Needs SST resource bindings, so run it through `sst shell`:
//
//   npx sst shell --stage production node --env-file=.env.local scripts/melee-import.ts
//   npx sst shell --stage production node --env-file=.env.local scripts/melee-import.ts --force 445226
//
// Already-imported tournaments are skipped unless --force is passed. Requests
// are sequential with a delay between them: melee asks that the API not be
// polled hard, and a 27-event backfill is exactly the job that would look like
// abuse if fired off in parallel.

import { listOnlineLocals, getStandings } from "../src/lib/melee.ts";
import { getTournament, importTournament } from "../src/lib/db.ts";
import { seasonFor } from "../src/lib/seasons.ts";

const DELAY_MS = 1500;

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--")).map(Number);

const events = (await listOnlineLocals()).filter(
  (t) => t.status === "Ended" && (only.length === 0 || only.includes(t.meleeId)),
);

if (events.length === 0) {
  console.error(only.length ? `no ended Online Local matches ${only.join(", ")}` : "nothing to import");
  process.exit(1);
}

console.log(`${events.length} ended Online Local(s) in scope\n`);

let imported = 0;
let skipped = 0;

for (const [i, event] of events.entries()) {
  const season = seasonFor(event.localNumber);
  const label = `${event.name} (${season?.name ?? "NO SEASON"})`;

  if (!force && (await getTournament(event.meleeId))) {
    console.log(`skip    ${label} — already imported`);
    skipped++;
    continue;
  }

  try {
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    const standings = await getStandings(event.meleeId);
    const row = await importTournament(event, standings);
    console.log(`import  ${label} — ${row.playerCount} players, scoring v${row.scoringVersion}`);
    imported++;
  } catch (err) {
    // Keep going: one bad event should not abandon a 27-event backfill.
    console.error(`FAIL    ${label} — ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${imported} imported, ${skipped} skipped, ${events.length - imported - skipped} failed`);
