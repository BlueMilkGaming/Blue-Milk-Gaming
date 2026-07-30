// Prize wall Dynamo I/O (redemption spec 2026-07-30). The redemption is one
// transaction (ADR 0004): debit conditional on funds, stock decrement
// conditional on stock, the Redemption row, the ledger entry. Either all
// land or none, which is what makes two players racing for the last
// playmat safe.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand,
  UpdateCommand, TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { ulid } from "./ulid.ts";
import { isConditionFailure } from "./dynamo.ts";
import { getBalance, balanceDebit, balanceRefund, entryPut, type LedgerEntry } from "./ledger.ts";
import { getAccount } from "./accounts.ts";
import { prizeById, redeemError, type PrizeRow, type RedemptionRow } from "./prizes.ts";
import { announceAdmin, SITE_URL } from "./discord.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const PRIZE = () => Resource.Prize.name;
const REDEMPTION = () => Resource.Redemption.name;

// ponytail: full-table scans below (Prize is ~20 rows, Redemption grows by a
// few a week). A byStatus sparse GSI is the upgrade if either ever hurts.
export async function allPrizeRows(): Promise<Map<string, PrizeRow>> {
  const res = await doc.send(new ScanCommand({ TableName: PRIZE() }));
  return new Map(((res.Items ?? []) as PrizeRow[]).map((r) => [r.prizeId, r]));
}

export async function redeem(playerId: string, displayName: string, prizeId: string): Promise<void> {
  const [account, balance, rows] = await Promise.all([
    getAccount(playerId), getBalance(playerId), allPrizeRows(),
  ]);
  const item = prizeById(prizeId);
  const row = rows.get(prizeId);
  const error = redeemError(item, row, balance.currencyBalance, !!account?.meleeUserIdentity);
  if (error) throw new Error(error);

  const cost = item!.points;
  const redemption: RedemptionRow = {
    playerId, redemptionId: ulid(), prizeId, displayName,
    costAtRedemption: cost, status: "pending", requestedAt: new Date().toISOString(),
  };
  type TransactItems = NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  >;
  const items: TransactItems = [
    balanceDebit(playerId, cost),
    { Put: { TableName: REDEMPTION(), Item: redemption } },
    entryPut({
      playerId, entryId: redemption.redemptionId, kind: "redemption",
      rankingDelta: 0, currencyDelta: -cost,
      refType: "redemption", refId: redemption.redemptionId,
      createdAt: redemption.requestedAt,
    } satisfies LedgerEntry),
  ];
  if (row?.stock !== undefined) {
    items.push({
      Update: {
        TableName: PRIZE(),
        Key: { prizeId },
        UpdateExpression: "ADD stock :neg",
        ConditionExpression: "stock >= :one",
        ExpressionAttributeValues: { ":neg": -1, ":one": 1 },
      },
    });
  }
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (isConditionFailure(err))
      throw new Error("That did not go through. Check your points, someone may also have beaten you to the last one.");
    throw err;
  }
  await announceAdmin(
    `**${displayName}** redeemed **${item!.name}** for ${cost.toLocaleString("en-US")} pts: ${SITE_URL}/admin/prizes`,
  );
}

export async function pendingRedemptions(): Promise<RedemptionRow[]> {
  const res = await doc.send(new ScanCommand({
    TableName: REDEMPTION(),
    FilterExpression: "#s = :p",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":p": "pending" },
  }));
  // ULIDs sort by creation time, so this is oldest request first.
  return ((res.Items ?? []) as RedemptionRow[]).sort((a, b) =>
    a.redemptionId < b.redemptionId ? -1 : 1);
}

export async function playerRedemptions(playerId: string): Promise<RedemptionRow[]> {
  const res = await doc.send(new QueryCommand({
    TableName: REDEMPTION(),
    KeyConditionExpression: "playerId = :p",
    ExpressionAttributeValues: { ":p": playerId },
    ScanIndexForward: false, // newest first
  }));
  return (res.Items ?? []) as RedemptionRow[];
}

export async function fulfilRedemption(playerId: string, redemptionId: string): Promise<void> {
  try {
    await doc.send(new UpdateCommand({
      TableName: REDEMPTION(),
      Key: { playerId, redemptionId },
      UpdateExpression: "SET #s = :f, fulfilledAt = :now",
      ConditionExpression: "#s = :p",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":f": "fulfilled", ":p": "pending", ":now": new Date().toISOString() },
    }));
  } catch (err) {
    if (isConditionFailure(err)) throw new Error("That redemption was already handled.");
    throw err;
  }
}

/** Cancel and refund in one transaction: points back, stock back if tracked. */
export async function cancelRedemption(playerId: string, redemptionId: string, note?: string): Promise<void> {
  const res = await doc.send(new GetCommand({ TableName: REDEMPTION(), Key: { playerId, redemptionId } }));
  const redemption = res.Item as RedemptionRow | undefined;
  if (!redemption || redemption.status !== "pending")
    throw new Error("That redemption was already handled.");

  const cost = redemption.costAtRedemption;
  const row = (await allPrizeRows()).get(redemption.prizeId);
  type TransactItems = NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  >;
  const items: TransactItems = [
    {
      Update: {
        TableName: REDEMPTION(),
        Key: { playerId, redemptionId },
        UpdateExpression: "SET #s = :c" + (note ? ", note = :n" : ""),
        ConditionExpression: "#s = :p",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":c": "cancelled", ":p": "pending", ...(note ? { ":n": note } : {}),
        },
      },
    },
    balanceRefund(playerId, cost),
    entryPut({
      playerId, entryId: `rfd-${redemptionId}`, kind: "redemption",
      rankingDelta: 0, currencyDelta: cost,
      refType: "redemption", refId: redemptionId,
      note: note ?? "cancelled", createdAt: new Date().toISOString(),
    } satisfies LedgerEntry, { once: true }),
  ];
  if (row?.stock !== undefined) {
    items.push({
      Update: {
        TableName: PRIZE(),
        Key: { prizeId: redemption.prizeId },
        UpdateExpression: "ADD stock :one",
        // Guards the race where an admin just cleared stock: if concurrent
        // clearStock removes the stock attribute, ADD would initialize it to 1.
        // This condition makes the increment fail loudly; the whole cancel aborts
        // and a retry's fresh read sees stock is gone, skipping the increment.
        ConditionExpression: "attribute_exists(stock)",
        ExpressionAttributeValues: { ":one": 1 },
      },
    });
  }
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (isConditionFailure(err)) throw new Error("That redemption was already handled.");
    throw err;
  }
}

export async function setStock(prizeId: string, stock: number): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: PRIZE(),
    Key: { prizeId },
    UpdateExpression: "SET stock = :n",
    ExpressionAttributeValues: { ":n": stock },
  }));
}

/** Back to unlimited. The row may linger holding only `hidden`; that is fine. */
export async function clearStock(prizeId: string): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: PRIZE(),
    Key: { prizeId },
    UpdateExpression: "REMOVE stock",
  }));
}

export async function setHidden(prizeId: string, hidden: boolean): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: PRIZE(),
    Key: { prizeId },
    UpdateExpression: hidden ? "SET hidden = :h" : "REMOVE hidden",
    ...(hidden ? { ExpressionAttributeValues: { ":h": true } } : {}),
  }));
}
