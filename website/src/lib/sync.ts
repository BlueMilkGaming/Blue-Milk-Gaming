// The import loop, shared by the manual backfill script and the weekly cron.
//
// Requests are sequential with a delay between them. Melee asks that the API
// not be polled hard, and a 27-event backfill is exactly the job that would
// look like abuse if fired off in parallel (ADR 0004). The weekly run has one
// event to fetch, so the delay costs it nothing.

import { listOnlineLocals, getStandings } from "./melee.ts";
import { getTournament, importTournament } from "./db.ts";
import { seasonFor } from "./seasons.ts";

const DELAY_MS = 1500;

export type SyncResult = {
  imported: string[];
  skipped: string[];
  failed: { event: string; error: string }[];
};

export type SyncOptions = {
  /** Re-import even if the tournament is already recorded. */
  force?: boolean;
  /** Restrict to specific melee tournament IDs. Empty means every ended event. */
  only?: number[];
};

/**
 * Import every ended Online Local that is not already recorded.
 *
 * Progress goes to the console so it lands in CloudWatch for the cron and on
 * the terminal for the script. One failed event never abandons the run: the
 * next invocation picks up whatever is still missing, which is what makes a
 * partial sync self-healing.
 */
export async function syncTournaments({ force = false, only = [] }: SyncOptions = {}): Promise<SyncResult> {
  const events = (await listOnlineLocals()).filter(
    (t) => t.status === "Ended" && (only.length === 0 || only.includes(t.meleeId)),
  );

  const result: SyncResult = { imported: [], skipped: [], failed: [] };
  console.log(`${events.length} ended Online Local(s) in scope`);

  for (const [i, event] of events.entries()) {
    const season = seasonFor(event.localNumber);
    const label = `${event.name} (${season?.name ?? "NO SEASON"})`;

    if (!force && (await getTournament(event.meleeId))) {
      console.log(`skip    ${label} — already imported`);
      result.skipped.push(event.name);
      continue;
    }

    try {
      if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
      const standings = await getStandings(event.meleeId);
      const row = await importTournament(event, standings);
      console.log(`import  ${label} — ${row.playerCount} players, scoring v${row.scoringVersion}`);
      result.imported.push(event.name);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`FAIL    ${label} — ${error}`);
      result.failed.push({ event: event.name, error });
    }
  }

  console.log(
    `${result.imported.length} imported, ${result.skipped.length} skipped, ${result.failed.length} failed`,
  );
  return result;
}
