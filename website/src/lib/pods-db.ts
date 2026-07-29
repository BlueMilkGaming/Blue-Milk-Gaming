// Pod Dynamo I/O (pods spec, Stage 2). One pod = one item; in-pod mutations
// are conditional writes on that item; join/leave/close pair the pod with
// Account.activePodId in a transaction. No lock table, no sweeper: expiry is
// applied lazily by whoever reads a stale pod.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand, TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import {
  POD_SIZE, POD_ROUNDS, clubDay, dealRound, effectiveStatus, roundComplete,
  reportError, flagError, unfrozenWins, settleUp, perWinDeltas,
  type PodRow, type Seat,
} from "./pods.ts";
import { ulid } from "./ulid.ts";
import { paidToday, entryPut, balanceCredit, type LedgerEntry } from "./ledger.ts";
import { announce, SITE_URL } from "./discord.ts";
import { getAccount } from "./accounts.ts";
import { PODS_V1 } from "./scoring.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const POD = () => Resource.Pod.name;
const ACCOUNT = () => Resource.Account.name;

function isConditionFailure(err: unknown): boolean {
  return err instanceof Error &&
    (err.name === "ConditionalCheckFailedException" || err.name === "TransactionCanceledException");
}

/** TransactWriteItems element: mark this player seated in `podId`. */
function claimActiveSeat(playerId: string, podId: string) {
  return {
    Update: {
      TableName: ACCOUNT(),
      Key: { discordUserId: playerId },
      UpdateExpression: "SET activePodId = :pod",
      ConditionExpression: "attribute_not_exists(activePodId)", // one active pod per player
      ExpressionAttributeValues: { ":pod": podId },
    },
  };
}

/** TransactWriteItems element: clear the seat pointer. Passes if already cleared. */
function releaseActiveSeat(playerId: string, podId: string) {
  return {
    Update: {
      TableName: ACCOUNT(),
      Key: { discordUserId: playerId },
      UpdateExpression: "REMOVE activePodId",
      ConditionExpression: "attribute_not_exists(activePodId) OR activePodId = :pod",
      ExpressionAttributeValues: { ":pod": podId },
    },
  };
}

export async function getPod(podId: string): Promise<PodRow> {
  const res = await doc.send(new GetCommand({ TableName: POD(), Key: { podId } }));
  if (!res.Item) throw new Error(`no pod ${podId}`);
  return res.Item as PodRow;
}

async function byStatus(status: PodRow["status"]): Promise<PodRow[]> {
  const res = await doc.send(new QueryCommand({
    TableName: POD(),
    IndexName: "byStatus",
    KeyConditionExpression: "#s = :s",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":s": status },
  }));
  return (res.Items ?? []) as PodRow[];
}

async function byDay(day: string): Promise<PodRow[]> {
  const res = await doc.send(new QueryCommand({
    TableName: POD(),
    IndexName: "byDay",
    KeyConditionExpression: "#d = :d",
    ExpressionAttributeNames: { "#d": "day" },
    ExpressionAttributeValues: { ":d": day },
  }));
  return (res.Items ?? []) as PodRow[];
}

/**
 * The live state of the tables, applying lazy expiry as a side effect.
 * Oldest open lobby first: overflow lobbies queue behind it by podId order.
 */
export async function tablesSnapshot(): Promise<{ lobby: PodRow | null; playingCount: number }> {
  const [filling, playing] = await Promise.all([byStatus("filling"), byStatus("playing")]);
  const staleLobbies = filling.filter((p) => effectiveStatus(p) === "abandoned");
  const stuckPods = playing.filter((p) => effectiveStatus(p) === "done");
  for (const pod of staleLobbies) await abandonPod(pod);
  for (const pod of stuckPods) await closePod(pod);
  const lobbies = filling
    .filter((p) => effectiveStatus(p) === "filling" && p.seats.length > 0)
    .sort((a, b) => (a.podId < b.podId ? -1 : 1));
  return { lobby: lobbies[0] ?? null, playingCount: playing.length - stuckPods.length };
}

/**
 * "Play now": join the open lobby or open the next one. Losing the race for
 * the 8th seat falls through to create; overflow is the next pod (spec).
 * Idempotent for an already-seated player.
 */
export async function joinOrCreate(playerId: string, displayName: string): Promise<PodRow> {
  const account = await getAccount(playerId);
  if (account?.activePodId) return getPod(account.activePodId);

  const now = new Date().toISOString();
  const seat: Seat = { playerId, displayName, joinedAt: now };

  for (let attempt = 0; attempt < 2; attempt++) {
    const { lobby } = await tablesSnapshot();
    if (!lobby) break;
    try {
      await doc.send(new TransactWriteCommand({ TransactItems: [
        {
          Update: {
            TableName: POD(),
            Key: { podId: lobby.podId },
            UpdateExpression: "SET seats = list_append(seats, :seat) ADD seatIds :id",
            ConditionExpression:
              "#s = :filling AND size(seatIds) < :cap AND NOT contains(seatIds, :pid)",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":seat": [seat], ":id": new Set([playerId]),
              ":filling": "filling", ":cap": POD_SIZE, ":pid": playerId,
            },
          },
        },
        claimActiveSeat(playerId, lobby.podId),
      ]}));
      const joined = await getPod(lobby.podId);
      if (joined.seats.length >= POD_SIZE) await launchPod(joined);
      else if (joined.seats.length === POD_SIZE - 2)
        await announce(`6 of 8 chairs taken at the Blue Milk Gaming tables. Two left: ${SITE_URL}/play`);
      return getPod(lobby.podId);
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      // Lobby filled or vanished between read and write; loop once, then create.
    }
  }

  const pod: PodRow = {
    podId: ulid(), status: "filling", day: clubDay(),
    seats: [seat], seatIds: new Set([playerId]), rounds: [], createdAt: now,
  };
  await doc.send(new TransactWriteCommand({ TransactItems: [
    { Put: { TableName: POD(), Item: pod, ConditionExpression: "attribute_not_exists(podId)" } },
    claimActiveSeat(playerId, pod.podId),
  ]}));
  await announce(`A table just opened at Blue Milk Gaming. First chair taken, seven to go: ${SITE_URL}/play`);
  return pod;
}

/** The 8th seat flips the pod to playing and deals round 1. Any caller may race; one wins. */
async function launchPod(pod: PodRow): Promise<void> {
  const now = new Date().toISOString();
  try {
    await doc.send(new UpdateCommand({
      TableName: POD(),
      Key: { podId: pod.podId },
      UpdateExpression: "SET #s = :playing, filledAt = :now, rounds = :r1",
      ConditionExpression: "#s = :filling AND size(seatIds) = :cap",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":playing": "playing", ":now": now, ":cap": POD_SIZE,
        ":r1": [{ pairings: dealRound(pod.seats, []), dealtAt: now }],
      },
    }));
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    return; // another caller dealt it
  }
  await announce("Pod launched at Blue Milk Gaming. Three rounds: coordinate in Discord, report on the site.");
}

/** Leave a filling lobby. CAS on the seat set so a concurrent join is never dropped. */
export async function leavePod(playerId: string, podId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const pod = await getPod(podId);
    if (pod.status !== "filling") throw new Error("You can only leave while the table is filling.");
    if (!pod.seatIds.has(playerId)) throw new Error("You are not seated there.");
    const seats = pod.seats.filter((s) => s.playerId !== playerId);
    try {
      await doc.send(new TransactWriteCommand({ TransactItems: [
        {
          Update: {
            TableName: POD(),
            Key: { podId },
            // An emptied lobby is abandoned on the spot. Dynamo forbids empty
            // sets, so DELETE drops seatIds entirely when the last seat goes.
            UpdateExpression: "SET seats = :seats, #s = :st DELETE seatIds :id",
            ConditionExpression: "#s = :filling AND size(seatIds) = :n AND contains(seatIds, :pid)",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":seats": seats, ":st": seats.length === 0 ? "abandoned" : "filling",
              ":id": new Set([playerId]), ":n": pod.seats.length, ":pid": playerId,
            },
          },
        },
        releaseActiveSeat(playerId, podId),
      ]}));
      return;
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      // Someone joined or left between read and write; re-read and retry.
    }
  }
  throw new Error("The table is busy; try leaving again.");
}

/** Lazy 60-minute expiry of an unfilled lobby. */
async function abandonPod(pod: PodRow): Promise<void> {
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: [
      {
        Update: {
          TableName: POD(),
          Key: { podId: pod.podId },
          UpdateExpression: "SET #s = :ab, closedAt = :now",
          ConditionExpression: "#s = :filling",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":ab": "abandoned", ":filling": "filling", ":now": new Date().toISOString() },
        },
      },
      ...pod.seats.map((s) => releaseActiveSeat(s.playerId, pod.podId)),
    ]}));
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    return; // someone else expired it
  }
  await announce("A table sat unfilled for an hour and was cleared. The next one opens when someone sits down.");
}

/** Replaced in the reporting/payout task. */
export async function closePod(pod: PodRow): Promise<void> {
  void pod;
  throw new Error("closePod lands with reporting/payout");
}
