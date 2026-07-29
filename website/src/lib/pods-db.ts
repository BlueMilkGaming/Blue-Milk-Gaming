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
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: POD(), Item: pod, ConditionExpression: "attribute_not_exists(podId)" } },
      claimActiveSeat(playerId, pod.podId),
    ]}));
    await announce(`A table just opened at Blue Milk Gaming. First chair taken, seven to go: ${SITE_URL}/play`);
    return pod;
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    // Concurrent join succeeded on another request; fetch the account's current pod.
    const currentAccount = await getAccount(playerId);
    if (currentAccount?.activePodId) return getPod(currentAccount.activePodId);
    throw new Error("Concurrent join failed to seat the player; try again.");
  }
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

/** Either player reports; a no-show claim is a report with the 30-minute gate. */
export async function reportResult(
  playerId: string,
  podId: string,
  roundIndex: number,
  matchIndex: number,
  winner: string,
  noShow = false,
): Promise<void> {
  const pod = await getPod(podId);
  const error = reportError(pod, playerId, roundIndex, matchIndex, winner, { noShow });
  if (error) throw new Error(error);
  const path = `rounds[${roundIndex}].pairings[${matchIndex}]`;
  await doc.send(new UpdateCommand({
    TableName: POD(),
    Key: { podId },
    UpdateExpression:
      `SET ${path}.winner = :w, ${path}.reportedBy = :p` + (noShow ? `, ${path}.noShow = :t` : ""),
    ConditionExpression: `#s = :playing AND attribute_not_exists(${path}.winner)`,
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
      ":w": winner, ":p": playerId, ":playing": "playing",
      ...(noShow ? { ":t": true } : {}),
    },
  }));
  await advanceIfComplete(podId);
}

/** All four results in: deal the next round, or close after round 3. */
async function advanceIfComplete(podId: string): Promise<void> {
  const pod = await getPod(podId);
  if (pod.status !== "playing") return;
  const current = pod.rounds[pod.rounds.length - 1];
  if (!roundComplete(current)) return;
  if (pod.rounds.length >= POD_ROUNDS) return closePod(pod);
  const now = new Date().toISOString();
  try {
    await doc.send(new UpdateCommand({
      TableName: POD(),
      Key: { podId },
      UpdateExpression: "SET rounds = list_append(rounds, :next)",
      ConditionExpression: "#s = :playing AND size(rounds) = :n",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":next": [{ pairings: dealRound(pod.seats, pod.rounds), dealtAt: now }],
        ":n": pod.rounds.length, ":playing": "playing",
      },
    }));
  } catch (err) {
    if (!isConditionFailure(err)) throw err; // the other reporter's write dealt it
  }
}

/** The opponent disputes a reported result; only that match's payout freezes. */
export async function flagResult(
  playerId: string,
  podId: string,
  roundIndex: number,
  matchIndex: number,
): Promise<void> {
  const pod = await getPod(podId);
  const error = flagError(pod, playerId, roundIndex, matchIndex);
  if (error) throw new Error(error);
  const path = `rounds[${roundIndex}].pairings[${matchIndex}]`;
  await doc.send(new UpdateCommand({
    TableName: POD(),
    Key: { podId },
    UpdateExpression: `SET ${path}.flaggedBy = :p`,
    ConditionExpression:
      `#s = :playing AND attribute_exists(${path}.winner) AND attribute_not_exists(${path}.flaggedBy)`,
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":p": playerId, ":playing": "playing" },
  }));
}

/**
 * Close and pay in one transaction, conditioned on status=playing, so racing
 * closers cannot double-pay. Called on the last report and by the lazy
 * 4-hour expiry, where unreported matches simply pay nothing (spec: honest
 * partial payout). Settle-up: each player is paid the value of their best two
 * pods today minus what today already paid, spread across this pod's
 * unfrozen wins; a flagged match's payout stays frozen for the admin.
 */
export async function closePod(pod: PodRow): Promise<void> {
  const now = new Date().toISOString();
  const todaysDone = (await byDay(pod.day)).filter(
    (p) => p.status === "done" && p.podId !== pod.podId,
  );

  type TransactItems = NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  >;
  const items: TransactItems = [
    {
      Update: {
        TableName: POD(),
        Key: { podId: pod.podId },
        UpdateExpression: "SET #s = :done, closedAt = :now",
        ConditionExpression: "#s = :playing",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":done": "done", ":playing": "playing", ":now": now },
      },
    },
    ...pod.seats.map((s) => releaseActiveSeat(s.playerId, pod.podId)),
  ];

  for (const seat of pod.seats) {
    const wins = unfrozenWins(pod.rounds, seat.playerId);
    if (wins.length === 0) continue;
    const priorPodWins = todaysDone.map((p) => unfrozenWins(p.rounds, seat.playerId).length);
    const alreadyPaid = await paidToday(seat.playerId, pod.day);
    const delta = settleUp([...priorPodWins, wins.length], alreadyPaid);
    const deltas = perWinDeltas(wins.length, delta);
    deltas.forEach((amount, i) => {
      items.push(entryPut({
        playerId: seat.playerId, entryId: ulid(), kind: "pod_win",
        rankingDelta: 0, currencyDelta: amount, day: pod.day,
        refType: "pod_match",
        refId: `${pod.podId}#r${wins[i].round + 1}m${wins[i].match + 1}`,
        createdAt: now,
      } satisfies LedgerEntry));
    });
    const total = deltas.reduce((sum, amount) => sum + amount, 0);
    if (total > 0) items.push(balanceCredit(seat.playerId, total));
  }

  // Max 1 + 8 + 8·(3 entries + 1 credit) = 41 items; Dynamo allows 100.
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (!isConditionFailure(err)) throw err; // another closer already paid
  }
}

export type FlaggedMatch = { pod: PodRow; roundIndex: number; matchIndex: number };

/** Unresolved flags across the given days (newest pods first). */
export async function unresolvedFlags(days: string[]): Promise<FlaggedMatch[]> {
  const pods = (await Promise.all(days.map(byDay))).flat();
  const flagged: FlaggedMatch[] = [];
  for (const pod of pods) {
    pod.rounds.forEach((round, roundIndex) =>
      round.pairings.forEach((match, matchIndex) => {
        if (match.flaggedBy && !match.flagResolution) flagged.push({ pod, roundIndex, matchIndex });
      }),
    );
  }
  return flagged.sort((x, y) => (x.pod.podId > y.pod.podId ? -1 : 1));
}

/**
 * Admin resolution. Uphold keeps the reported winner; overturn flips it;
 * void pays nobody. A still-playing pod needs no money now: close pays the
 * resolved win like any other. A closed pod gets the withheld payout as an
 * adjustment entry.
 */
export async function resolveFlag(
  podId: string,
  roundIndex: number,
  matchIndex: number,
  decision: "uphold" | "overturn" | "void",
): Promise<void> {
  const pod = await getPod(podId);
  const match = pod.rounds[roundIndex]?.pairings[matchIndex];
  if (!match?.flaggedBy || match.flagResolution) throw new Error("No unresolved flag there.");
  const path = `rounds[${roundIndex}].pairings[${matchIndex}]`;
  const trueWinner = decision === "overturn" ? (match.winner === match.a ? match.b : match.a) : match.winner!;

  type TransactItems = NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  >;
  const items: TransactItems = [{
    Update: {
      TableName: POD(),
      Key: { podId },
      UpdateExpression:
        `SET ${path}.flagResolution = :d` + (decision === "overturn" ? `, ${path}.winner = :tw` : ""),
      ConditionExpression:
        `attribute_exists(${path}.flaggedBy) AND attribute_not_exists(${path}.flagResolution)`,
      ExpressionAttributeValues: {
        ":d": decision, ...(decision === "overturn" ? { ":tw": trueWinner } : {}),
      },
    },
  }];

  if (pod.status === "done" && decision !== "void") {
    // ponytail: pays flat winCurrency, skipping a best-two-per-day recompute.
    // Resolutions are rare, admin-audited, and err in the player's favor.
    items.push(entryPut({
      playerId: trueWinner, entryId: ulid(), kind: "adjustment",
      rankingDelta: 0, currencyDelta: PODS_V1.winCurrency, day: pod.day,
      refType: "pod_match", refId: `${podId}#r${roundIndex + 1}m${matchIndex + 1}`,
      note: `flag ${decision}`, createdAt: new Date().toISOString(),
    } satisfies LedgerEntry));
    items.push(balanceCredit(trueWinner, PODS_V1.winCurrency));
  }

  await doc.send(new TransactWriteCommand({ TransactItems: items }));
}
