// Weekly melee.gg sync. Runs Monday morning, after Sunday night's Online Local.
//
// It imports whatever ended events are missing, not just last night's, so a
// week that failed is picked up by the next run without anyone intervening.

import { Resource } from "sst";

import { announceAdmin } from "../lib/discord.ts";
import { syncTournaments } from "../lib/sync.ts";

export async function handler() {
  // The melee client reads credentials from the environment so that the same
  // code works under `sst shell` for the manual script. Linked secrets are only
  // available via Resource, so bridge them here rather than baking them into
  // the function's environment, where they would be readable from the Lambda
  // config by anyone with GetFunctionConfiguration.
  process.env.MELEE_CLIENT_ID = Resource.MeleeClientId.value;
  process.env.MELEE_CLIENT_SECRET = Resource.MeleeClientSecret.value;

  try {
    const result = await syncTournaments();

    // Throwing marks the invocation failed in CloudWatch on top of the ping.
    if (result.failed.length > 0) {
      throw new Error(
        `melee sync: ${result.failed.length} event(s) failed — ${result.failed
          .map((f) => `${f.event}: ${f.error}`)
          .join("; ")}`,
      );
    }

    return result;
  } catch (err) {
    // The next Monday run re-imports anything missing, so the ping is a
    // heads-up, not a call to action.
    await announceAdmin(
      `⚠️ Weekly melee sync failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
}
