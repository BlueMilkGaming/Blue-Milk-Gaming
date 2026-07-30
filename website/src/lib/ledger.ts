// PointsLedger + PlayerBalance (ADR 0004), first consumers: pod wins and
// admin flag adjustments. Append-only entries; balances are written in the
// same transaction as their entries and are rebuildable from the ledger.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { listTournaments, getPlacements } from "./db.ts";
import { isConditionFailure } from "./dynamo.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const LEDGER = () => Resource.PointsLedger.name;
const BALANCE = () => Resource.PlayerBalance.name;

export type LedgerEntry = {
  playerId: string;   // Discord snowflake: everything in this table keys on the Discord ID
  entryId: string;    // ULID, or a deterministic id (plc-/rfd- prefixed) where idempotency matters
  kind: "pod_win" | "adjustment" | "redemption" | "placement";
  rankingDelta: 0;    // this ledger never moves competitive standing (ADR 0004)
  currencyDelta: number;
  /** clubDay settle-up bucket. Pod kinds only; omitted on redemption and
      placement entries so paidToday's day filter never sees them. */
  day?: string;
  refType: "pod_match" | "redemption" | "placement";
  refId: string;
  note?: string;
  createdAt: string;
};

/** Sum of currency already paid to this player for `day`'s pods. */
export async function paidToday(playerId: string, day: string): Promise<number> {
  // ponytail: full-partition query filtered on day. A weekly player accrues a
  // few hundred entries in years; make day part of a sort key if that changes.
  const res = await doc.send(new QueryCommand({
    TableName: LEDGER(),
    KeyConditionExpression: "playerId = :p",
    FilterExpression: "#d = :day",
    ExpressionAttributeNames: { "#d": "day" }, // DAY is a Dynamo reserved word
    ExpressionAttributeValues: { ":p": playerId, ":day": day },
  }));
  return ((res.Items ?? []) as LedgerEntry[]).reduce((sum, e) => sum + e.currencyDelta, 0);
}

/** TransactWriteItems element appending one ledger entry. `once` makes a
    deterministic entryId idempotent: a second write is a condition failure. */
export function entryPut(entry: LedgerEntry, { once = false } = {}) {
  return {
    Put: {
      TableName: LEDGER(),
      Item: entry,
      ...(once ? { ConditionExpression: "attribute_not_exists(entryId)" } : {}),
    },
  };
}

/** TransactWriteItems element crediting a balance (creates the row on first credit). */
export function balanceCredit(playerId: string, amount: number) {
  return {
    Update: {
      TableName: BALANCE(),
      Key: { playerId },
      UpdateExpression:
        "ADD currencyBalance :a, lifetimeEarned :a SET lifetimeSpent = if_not_exists(lifetimeSpent, :zero)",
      ExpressionAttributeValues: { ":a": amount, ":zero": 0 },
    },
  };
}

export type Balance = { currencyBalance: number; lifetimeEarned: number; lifetimeSpent: number };

export async function getBalance(playerId: string): Promise<Balance> {
  const res = await doc.send(new GetCommand({ TableName: BALANCE(), Key: { playerId } }));
  return { currencyBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0, ...(res.Item ?? {}) };
}

/** TransactWriteItems element spending from a balance; fails when funds are short. */
export function balanceDebit(playerId: string, amount: number) {
  return {
    Update: {
      TableName: BALANCE(),
      Key: { playerId },
      UpdateExpression: "ADD currencyBalance :neg, lifetimeSpent :a",
      ConditionExpression: "currencyBalance >= :a",
      ExpressionAttributeValues: { ":a": amount, ":neg": -amount },
    },
  };
}

/** TransactWriteItems element returning a cancelled redemption's points. */
export function balanceRefund(playerId: string, amount: number) {
  return {
    Update: {
      TableName: BALANCE(),
      Key: { playerId },
      UpdateExpression: "ADD currencyBalance :a, lifetimeSpent :neg",
      ExpressionAttributeValues: { ":a": amount, ":neg": -amount },
    },
  };
}

/** Deterministic entryId for a tournament's placement credit: every path that
    could pay it (approval, cron, script, --force re-import) collides here. */
export function placementEntryId(meleeId: number): string {
  return `plc-${meleeId}`;
}

/** The placement credits this player is still owed. Pure; caller supplies state. */
export function missingCredits(
  placements: { meleeId: number; meleeUserIdentity: string; currencyPointsAwarded: number }[],
  meleeUserIdentity: string,
  existingEntryIds: Set<string>,
): { meleeId: number; amount: number }[] {
  return placements
    .filter((p) => p.meleeUserIdentity === meleeUserIdentity && p.currencyPointsAwarded > 0)
    .filter((p) => !existingEntryIds.has(placementEntryId(p.meleeId)))
    .map((p) => ({ meleeId: p.meleeId, amount: p.currencyPointsAwarded }));
}

async function placementCreditIds(playerId: string): Promise<Set<string>> {
  const res = await doc.send(new QueryCommand({
    TableName: LEDGER(),
    KeyConditionExpression: "playerId = :p AND begins_with(entryId, :plc)",
    ExpressionAttributeValues: { ":p": playerId, ":plc": "plc-" },
  }));
  return new Set(((res.Items ?? []) as LedgerEntry[]).map((e) => e.entryId));
}

async function creditMissing(
  discordUserId: string,
  meleeUserIdentity: string,
  placements: { meleeId: number; meleeUserIdentity: string; currencyPointsAwarded: number }[],
): Promise<number> {
  const existing = await placementCreditIds(discordUserId);
  const owed = missingCredits(placements, meleeUserIdentity, existing);
  const now = new Date().toISOString();
  let credited = 0;
  for (const { meleeId, amount } of owed) {
    try {
      await doc.send(new TransactWriteCommand({ TransactItems: [
        entryPut({
          playerId: discordUserId, entryId: placementEntryId(meleeId),
          kind: "placement", rankingDelta: 0, currencyDelta: amount,
          refType: "placement", refId: `${meleeId}#${meleeUserIdentity}`,
          createdAt: now,
        }, { once: true }),
        balanceCredit(discordUserId, amount),
      ]}));
      credited++;
    } catch (err) {
      if (!isConditionFailure(err)) throw err; // a concurrent reconcile already paid it
    }
  }
  return credited;
}

async function allPlacements() {
  const tournaments = await listTournaments();
  const perEvent = await Promise.all(tournaments.map((t) => getPlacements(t.meleeId)));
  return perEvent.flat();
}

/**
 * Credit any tournament placements the ledger has not paid this player yet.
 * Idempotent and safe to run any time: claim approval calls it as the
 * full-history opening credit, and the weekly cron re-runs it for every
 * linked player, so a credit lost to a crash self-heals a week later at worst.
 */
export async function reconcilePlayer(discordUserId: string, meleeUserIdentity: string): Promise<number> {
  return creditMissing(discordUserId, meleeUserIdentity, await allPlacements());
}

// ponytail: one full placement sweep per run (~30 queries at dozens scale);
// cache per-identity or add a Placement GSI if the club outgrows it.
export async function reconcilePlacementCredits(linked: Map<string, string>): Promise<number> {
  const placements = await allPlacements();
  let credited = 0;
  for (const [meleeUserIdentity, discordUserId] of linked) {
    credited += await creditMissing(discordUserId, meleeUserIdentity, placements);
  }
  return credited;
}
