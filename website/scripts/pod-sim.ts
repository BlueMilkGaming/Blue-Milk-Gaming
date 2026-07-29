// Synthetic pod opponents for end-to-end testing without extra Discord
// accounts (Stage 2, Task 12). Sim players go through the real
// joinOrCreate/reportResult code paths, so what gets exercised is exactly
// the production flow; you play your own seat through /play as usual.
//
// Heads up: joins and launches post real webhook announcements to the
// Discord channel. Swap PodsWebhookUrl to a test-channel webhook first if
// that matters (needs a redeploy each way).
//
// Needs SST resource bindings, so run it through `sst shell`:
//
//   npx sst shell --stage production -- node scripts/pod-sim.ts join 7
//   npx sst shell --stage production -- node scripts/pod-sim.ts report
//   npx sst shell --stage production -- node scripts/pod-sim.ts false-report <yourDiscordId>
//   npx sst shell --stage production -- node scripts/pod-sim.ts cleanup <yourDiscordId>
//
// join N        seat N sim players (the real join transaction; 8th seat launches)
// report        report every unreported sim-vs-sim match of the current round,
//               winner = seat listed first; the last report deals the next
//               round or closes the pod through the real advance path
// false-report  your sim opponent reports themselves the winner of YOUR match,
//               so you can exercise the flag button and /admin/flags
// cleanup       delete every row the test created: sim pods, sim/your test
//               ledger entries, sim accounts and balances; your balance is
//               rebuilt from whatever ledger entries remain

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, DeleteCommand, QueryCommand, ScanCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { getPod, joinOrCreate, reportResult } from "../src/lib/pods-db.ts";
import { getAccount } from "../src/lib/accounts.ts";
import type { LedgerEntry } from "../src/lib/ledger.ts";
import type { PodRow } from "../src/lib/pods.ts";

const SIM_PREFIX = "sim-player-";
const simId = (n: number) => `${SIM_PREFIX}${n}`;
const isSim = (id: string) => id.startsWith(SIM_PREFIX);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

/** The pod the sim players are currently seated in, via their own pointer. */
async function simPod(): Promise<PodRow> {
  const account = await getAccount(simId(1));
  if (!account?.activePodId) throw new Error("no sim players seated; run join first");
  return getPod(account.activePodId);
}

async function join(count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    const pod = await joinOrCreate(simId(i), `Sim Player ${i}`);
    console.log(`Sim Player ${i} seated in ${pod.podId} (${pod.seats.length} seats, ${pod.status})`);
  }
}

async function report(): Promise<void> {
  const pod = await simPod();
  if (pod.status !== "playing") throw new Error(`pod is ${pod.status}, nothing to report`);
  const roundIndex = pod.rounds.length - 1;
  for (const [matchIndex, match] of pod.rounds[roundIndex].pairings.entries()) {
    if (match.winner || !isSim(match.a) || !isSim(match.b)) continue;
    await reportResult(match.a, pod.podId, roundIndex, matchIndex, match.a);
    console.log(`round ${roundIndex + 1}: ${match.a} beat ${match.b}`);
  }
  const after = await getPod(pod.podId);
  console.log(`pod is now ${after.status}, round ${after.rounds.length} of 3`);
}

async function falseReport(yourId: string): Promise<void> {
  const pod = await simPod();
  const roundIndex = pod.rounds.length - 1;
  const matchIndex = pod.rounds[roundIndex].pairings.findIndex(
    (m) => m.a === yourId || m.b === yourId,
  );
  const match = pod.rounds[roundIndex].pairings[matchIndex];
  if (!match) throw new Error("you have no match this round");
  if (match.winner) throw new Error("your match is already reported");
  const opponent = match.a === yourId ? match.b : match.a;
  await reportResult(opponent, pod.podId, roundIndex, matchIndex, opponent);
  console.log(`${opponent} claims they beat you in round ${roundIndex + 1}; go flag it on /play`);
}

async function cleanup(yourId: string): Promise<void> {
  // Pods: anything a sim player ever sat in is test data.
  const pods = ((await doc.send(new ScanCommand({ TableName: Resource.Pod.name })))
    .Items ?? []) as PodRow[];
  const testPods = pods.filter((p) => p.seats.some((s) => isSim(s.playerId)));
  const testPodIds = new Set(testPods.map((p) => p.podId));
  for (const pod of testPods) {
    await doc.send(new DeleteCommand({ TableName: Resource.Pod.name, Key: { podId: pod.podId } }));
    console.log(`deleted pod ${pod.podId} (${pod.status})`);
  }

  // Ledger entries that reference a test pod, yours included; sim entries all go.
  const players = [yourId, ...Array.from({ length: 8 }, (_, i) => simId(i + 1))];
  for (const playerId of players) {
    const entries = ((await doc.send(new QueryCommand({
      TableName: Resource.PointsLedger.name,
      KeyConditionExpression: "playerId = :p",
      ExpressionAttributeValues: { ":p": playerId },
    }))).Items ?? []) as LedgerEntry[];
    let remaining = 0;
    for (const entry of entries) {
      const fromTestPod = [...testPodIds].some((id) => entry.refId.startsWith(id));
      if (isSim(playerId) || fromTestPod) {
        await doc.send(new DeleteCommand({
          TableName: Resource.PointsLedger.name,
          Key: { playerId, entryId: entry.entryId },
        }));
        console.log(`deleted ledger entry ${playerId} ${entry.refId} (${entry.currencyDelta})`);
      } else {
        remaining += entry.currencyDelta;
      }
    }
    // Balances are derived data: rebuild yours from what survived, drop sims'.
    if (isSim(playerId) || remaining === 0) {
      await doc.send(new DeleteCommand({ TableName: Resource.PlayerBalance.name, Key: { playerId } }));
    } else {
      await doc.send(new UpdateCommand({
        TableName: Resource.PlayerBalance.name,
        Key: { playerId },
        UpdateExpression: "SET currencyBalance = :b, lifetimeEarned = :b, lifetimeSpent = :zero",
        ExpressionAttributeValues: { ":b": remaining, ":zero": 0 },
      }));
    }
  }
  console.log(`rebuilt balance for ${yourId} from remaining ledger entries`);

  // Accounts: sims disappear; your pointer clears only if it aims at a test pod.
  for (let i = 1; i <= 8; i++) {
    await doc.send(new DeleteCommand({ TableName: Resource.Account.name, Key: { discordUserId: simId(i) } }));
  }
  const you = await getAccount(yourId);
  if (you?.activePodId && testPodIds.has(you.activePodId)) {
    await doc.send(new UpdateCommand({
      TableName: Resource.Account.name,
      Key: { discordUserId: yourId },
      UpdateExpression: "REMOVE activePodId",
    }));
    console.log("cleared your activePodId");
  }
  console.log("cleanup done");
}

const [command, arg] = process.argv.slice(2);
if (command === "join") await join(Number(arg ?? 7));
else if (command === "report") await report();
else if (command === "false-report" && arg) await falseReport(arg);
else if (command === "cleanup" && arg) await cleanup(arg);
else {
  console.error("usage: pod-sim.ts join <n> | report | false-report <yourDiscordId> | cleanup <yourDiscordId>");
  process.exit(1);
}
