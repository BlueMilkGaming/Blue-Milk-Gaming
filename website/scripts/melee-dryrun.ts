// Read-only probe against melee.gg. Writes nothing, stores nothing.
//
//   node --env-file=.env.local scripts/melee-dryrun.ts          # list events
//   node --env-file=.env.local scripts/melee-dryrun.ts 445226   # one event's standings
//
// Output is deliberately limited to the fields the importer keeps, so pasting
// it into a chat or an issue cannot leak PII.

import { listOnlineLocals, getStandings } from "../src/lib/melee.ts";
import { awardFor, CURRENT_SCORING } from "../src/lib/scoring.ts";

const id = Number(process.argv[2]);

if (!id) {
  const events = await listOnlineLocals();
  for (const t of events) {
    console.log(`${String(t.meleeId).padEnd(8)} ${t.name.padEnd(24)} ${t.lastPairDate}  ${t.status}`);
  }
  console.log(`\n${events.length} Online Locals, ${events.filter((t) => t.status === "Ended").length} ended`);
} else {
  const standings = await getStandings(id);
  console.log(`${standings.length} players, scoring v${CURRENT_SCORING.version}\n`);
  let awarded = 0;
  for (const p of standings.slice(0, 10)) {
    const award = awardFor(p.finishRank);
    awarded += award.ranking;
    console.log(
      `${String(p.finishRank).padStart(3)}. ${p.displayName.padEnd(24)} ` +
      `${p.recordWins}-${p.recordLosses}  ${String(award.ranking).padStart(4)} pts  (${p.meleeUserIdentity.slice(0, 8)})`,
    );
  }
  console.log(`\ntop 8 awarded: ${awarded} ranking points`);
}
