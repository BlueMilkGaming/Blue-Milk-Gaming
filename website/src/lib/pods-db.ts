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
  POD_SIZE, POD_ROUNDS, POD_MIN, HEARTBEAT_MS, clubDay, dealRound, effectiveStatus, roundComplete,
  reportError, flagError, fireError, shouldPingLfg, unfrozenWins, settleUp, perWinDeltas,
  type PodRow, type Seat,
} from "./pods.ts";
import { ulid } from "./ulid.ts";
import { paidToday, entryPut, balanceCredit, type LedgerEntry } from "./ledger.ts";
import { announceWait, editAnnouncement, announceAdmin, SITE_URL } from "./discord.ts";
import { getAccount } from "./accounts.ts";
import { PODS_V1 } from "./scoring.ts";
import { isConditionFailure } from "./dynamo.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const POD = () => Resource.Pod.name;
const ACCOUNT = () => Resource.Account.name;

// Green = taken, white = open. Red reads as "bad seat", not "open seat".
// Spread iterates code points, so the emoji survive; spaces read better in Discord.
function seatBar(taken: number): string {
  return [...("🟩".repeat(taken) + "⬜".repeat(POD_SIZE - taken))].join(" ");
}

function fillingMessage(taken: number): string {
  return `${seatBar(taken)}\nA table is filling at Blue Milk Gaming: ${taken} of ${POD_SIZE} chairs taken. The host can launch with ${POD_MIN} or 6; a full table of ${POD_SIZE} deals itself: <${SITE_URL}/play>`;
}
function launchedMessage(players: number): string {
  return `${[..."🟩".repeat(players)].join(" ")}\nPod launched with ${players} players at Blue Milk Gaming. Three rounds: coordinate in Discord, report on the site.`;
}
function finishedMessage(players: number): string {
  return `${[..."🟩".repeat(players)].join(" ")}\nPod finished at Blue Milk Gaming: ${players} players, three rounds in the books. Next table: <${SITE_URL}/play>`;
}
// No seat bar: a row of empty blocks on a dead table is noise.
function clearedMessage(): string {
  return `The table was cleared. The next one opens when someone sits down: <${SITE_URL}/play>`;
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

/**
 * `consistent` costs 2x read capacity, so it is reserved for the two spots
 * where a stale read wedges a pod with no self-heal: the post-join launch
 * decision and the post-report advance decision.
 */
export async function getPod(podId: string, { consistent = false } = {}): Promise<PodRow> {
  const res = await doc.send(new GetCommand({ TableName: POD(), Key: { podId }, ConsistentRead: consistent }));
  if (!res.Item) throw new Error(`no pod ${podId}`);
  return res.Item as PodRow;
}

/**
 * Best-effort lastSeenAt stamp on the caller's seat, throttled to one write
 * per HEARTBEAT_MS. Condition on the seat index still holding this player:
 * if a leave shifted the list or the pod launched, skip; the next poll retries.
 */
export async function touchSeat(pod: PodRow, playerId: string): Promise<void> {
  if (pod.status !== "filling") return;
  const i = pod.seats.findIndex((s) => s.playerId === playerId);
  if (i < 0) return;
  const seat = pod.seats[i];
  if (Date.now() - Date.parse(seat.lastSeenAt ?? seat.joinedAt) < HEARTBEAT_MS) return;
  await doc.send(new UpdateCommand({
    TableName: POD(),
    Key: { podId: pod.podId },
    UpdateExpression: `SET seats[${i}].lastSeenAt = :now`,
    ConditionExpression: `#s = :filling AND seats[${i}].playerId = :pid`,
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
      ":now": new Date().toISOString(), ":filling": "filling", ":pid": playerId,
    },
  })).catch(() => {});
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
export async function joinOrCreate(
  playerId: string,
  displayName: string,
  avatar: string | null = null,
): Promise<PodRow> {
  const account = await getAccount(playerId);
  if (account?.activePodId) {
    const pointedPod = await getPod(account.activePodId);
    if (pointedPod.status === "filling" || pointedPod.status === "playing") return pointedPod;
    // A join can race an abandon/close: the pointer was set before this pod
    // ended, so it now points at a dead pod forever unless we clear it here
    // and fall through to a normal join.
    try {
      await doc.send(new UpdateCommand({
        TableName: ACCOUNT(),
        Key: { discordUserId: playerId },
        UpdateExpression: "REMOVE activePodId",
        ConditionExpression: "activePodId = :pod",
        ExpressionAttributeValues: { ":pod": account.activePodId },
      }));
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      // Already cleared, or repointed at a new pod, by another request; either way, join fresh.
    }
  }

  const now = new Date().toISOString();
  const seat: Seat = { playerId, displayName, joinedAt: now, avatar };

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
      // Consistent: a stale 7-seat read here means nobody ever launches this pod.
      const joined = await getPod(lobby.podId, { consistent: true });
      if (joined.seats.length >= POD_SIZE) await launchPod(joined);
      else await editAnnouncement(joined.announceMessageId, fillingMessage(joined.seats.length));
      return getPod(lobby.podId);
    } catch (err) {
      if (!isConditionFailure(err)) throw err;
      // Lobby filled or vanished between read and write; loop once, then create.
    }
  }

  const ping = shouldPingLfg(await byDay(clubDay()));
  const pod: PodRow = {
    podId: ulid(), status: "filling", day: clubDay(),
    seats: [seat], seatIds: new Set([playerId]), rounds: [], createdAt: now,
  };
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: POD(), Item: pod, ConditionExpression: "attribute_not_exists(podId)" } },
      claimActiveSeat(playerId, pod.podId),
    ]}));
    const messageId = await announceWait(
      fillingMessage(1),
      ping ? { pingRoleId: Resource.LfgRoleId.value } : {},
    );
    if (messageId) {
      pod.announceMessageId = messageId;
      // Best effort: if this write is lost the pod just has no editable card.
      await doc.send(new UpdateCommand({
        TableName: POD(), Key: { podId: pod.podId },
        UpdateExpression: "SET announceMessageId = :m",
        ExpressionAttributeValues: { ":m": messageId },
      })).catch(() => {});
    }
    return pod;
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    // Concurrent join succeeded on another request; fetch the account's current pod.
    const currentAccount = await getAccount(playerId);
    if (currentAccount?.activePodId) return getPod(currentAccount.activePodId);
    throw new Error("Concurrent join failed to seat the player; try again.");
  }
}

/** Flip filling → playing and deal round 1. Condition on the exact seats the
 * caller read (set equality, not just count), so any membership change
 * (a swap that leaves the count unchanged, not just a join/leave that
 * changes it) fails the launch cleanly. Any caller may race; one wins.
 * Returns whether this call did the launch. */
async function launchPod(pod: PodRow): Promise<boolean> {
  const players = pod.seats.length;
  const now = new Date().toISOString();
  try {
    await doc.send(new UpdateCommand({
      TableName: POD(),
      Key: { podId: pod.podId },
      UpdateExpression: "SET #s = :playing, filledAt = :now, rounds = :r1",
      ConditionExpression: "#s = :filling AND seatIds = :ids",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":playing": "playing", ":filling": "filling", ":now": now,
        ":ids": new Set(pod.seats.map((s) => s.playerId)),
        ":r1": [{ pairings: dealRound(pod.seats, []), dealtAt: now }],
      },
    }));
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    return false; // another caller dealt it, or the seats changed underneath
  }
  await editAnnouncement(pod.announceMessageId, launchedMessage(players));
  return true;
}

/** The host launches early with 4 or 6 seated. */
export async function firePod(playerId: string, podId: string): Promise<void> {
  // Consistent: firing on a stale seat list would deal the wrong table.
  const pod = await getPod(podId, { consistent: true });
  const error = fireError(pod, playerId);
  if (error) throw new Error(error);
  if (!(await launchPod(pod)))
    throw new Error("The table changed as you launched; look again.");
}

/**
 * Stand a player up from a filling lobby. One path for player leave, the
 * stale-seat sweep, and admin kick. CAS on the seat set so a concurrent
 * join is never dropped.
 */
export async function removeSeat(podId: string, playerId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const pod = await getPod(podId);
    if (pod.status !== "filling") throw new Error("The table is no longer filling.");
    if (!pod.seatIds.has(playerId)) throw new Error("Not seated at that table.");
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
              ":filling": "filling",
              ":id": new Set([playerId]), ":n": pod.seats.length, ":pid": playerId,
            },
          },
        },
        releaseActiveSeat(playerId, podId),
      ]}));
      await editAnnouncement(
        pod.announceMessageId,
        seats.length === 0 ? clearedMessage() : fillingMessage(seats.length),
      );
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
  await editAnnouncement(pod.announceMessageId, clearedMessage());
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
  // Consistent: a stale read here misses the round's last report and the
  // round never advances until the 4-hour lazy close.
  const pod = await getPod(podId, { consistent: true });
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
  const flagger = pod.seats.find((s) => s.playerId === playerId)?.displayName ?? "A player";
  await announceAdmin(`**${flagger}** flagged a match result at the tables: ${SITE_URL}/admin/flags`);
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
    if (!isConditionFailure(err)) throw err;
    return; // another closer already paid (and edited)
  }
  await editAnnouncement(pod.announceMessageId, finishedMessage(pod.seats.length));
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
