// PointsLedger + PlayerBalance (ADR 0004), first consumers: pod wins and
// admin flag adjustments. Append-only entries; balances are written in the
// same transaction as their entries and are rebuildable from the ledger.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const LEDGER = () => Resource.PointsLedger.name;
const BALANCE = () => Resource.PlayerBalance.name;

export type LedgerEntry = {
  playerId: string;   // Discord snowflake: pod entries key on the Discord ID (spec)
  entryId: string;    // ULID, so a partition reads in time order
  kind: "pod_win" | "adjustment";
  rankingDelta: 0;    // pods pay currency only, never ranking (spec)
  currencyDelta: number;
  day: string;        // clubDay at pod creation; the settle-up bucket
  refType: "pod_match";
  refId: string;      // `${podId}#r{round}m{match}`, 1-based
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

/** TransactWriteItems element appending one ledger entry. */
export function entryPut(entry: LedgerEntry) {
  return { Put: { TableName: LEDGER(), Item: entry } };
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
