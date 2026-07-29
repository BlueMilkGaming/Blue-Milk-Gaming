// Discord-side accounts and the melee claim flow (pods spec, Stage 1).
// An account is created at first need, claims go to a queue, and admin
// approval sets the pointer. The Player table is never modified.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const TABLE = () => Resource.Account.name;

export type AccountRow = {
  discordUserId: string;
  displayName: string;
  meleeUserIdentity?: string;
  pendingClaim?: string;
  activePodId?: string; // one active pod per player; set on join, cleared on leave/close
  createdAt: string;
};

/** Why this claim is not allowed, or null if it is. Pure; caller supplies state. */
export function claimError(
  account: AccountRow | undefined,
  taken: Set<string>,
  meleeUserIdentity: string,
): string | null {
  if (account?.meleeUserIdentity) return "This account is already linked to a melee name.";
  if (account?.pendingClaim) return "You already have a claim pending review.";
  if (taken.has(meleeUserIdentity)) return "That melee name is taken by another account.";
  return null;
}

/** Why this claim approval is not allowed, or null if it is. Pure; caller supplies state. */
export function approvalError(
  account: AccountRow | undefined,
  otherAccounts: AccountRow[],
): string | null {
  if (!account?.pendingClaim) return null; // ConditionExpression catches missing claim

  // Check if another account already holds this identity (concurrent claim race)
  if (otherAccounts.some((a) => a.meleeUserIdentity === account.pendingClaim)) {
    return "That melee name is now held by another account.";
  }

  return null;
}

export async function getAccount(discordUserId: string): Promise<AccountRow | undefined> {
  const res = await doc.send(new GetCommand({ TableName: TABLE(), Key: { discordUserId } }));
  return res.Item as AccountRow | undefined;
}

export async function ensureAccount(discordUserId: string, displayName: string): Promise<AccountRow> {
  const res = await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    // Refresh the Discord display name on every touch; set createdAt once.
    UpdateExpression: "SET displayName = :n, createdAt = if_not_exists(createdAt, :now)",
    ExpressionAttributeValues: { ":n": displayName, ":now": new Date().toISOString() },
    ReturnValues: "ALL_NEW",
  }));
  return res.Attributes as AccountRow;
}

// ponytail: full-table Scans below. Accounts number in the dozens; a GSI on
// meleeUserIdentity and a pendingClaim sparse index are the upgrade if the
// club somehow reaches thousands.
async function allAccounts(): Promise<AccountRow[]> {
  const res = await doc.send(new ScanCommand({ TableName: TABLE() }));
  return (res.Items ?? []) as AccountRow[];
}

export async function requestClaim(discordUserId: string, meleeUserIdentity: string): Promise<void> {
  const [account, accounts] = await Promise.all([getAccount(discordUserId), allAccounts()]);
  const taken = new Set(
    accounts.flatMap((a) => (a.meleeUserIdentity ? [a.meleeUserIdentity] : [])),
  );
  const error = claimError(account, taken, meleeUserIdentity);
  if (error) throw new Error(error);
  await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    UpdateExpression: "SET pendingClaim = :m",
    // Guards the race where two tabs submit at once.
    ConditionExpression: "attribute_not_exists(pendingClaim) AND attribute_not_exists(meleeUserIdentity)",
    ExpressionAttributeValues: { ":m": meleeUserIdentity },
  }));
}

export async function listPendingClaims(): Promise<AccountRow[]> {
  return (await allAccounts()).filter((a) => a.pendingClaim);
}

export async function resolveClaim(discordUserId: string, approve: boolean): Promise<void> {
  if (approve) {
    const [account, accounts] = await Promise.all([getAccount(discordUserId), allAccounts()]);
    const otherAccounts = accounts.filter((a) => a.discordUserId !== discordUserId);
    const error = approvalError(account, otherAccounts);
    if (error) throw new Error(error);
    if (!account?.pendingClaim) throw new Error("No pending claim to approve.");

    await doc.send(new UpdateCommand({
      TableName: TABLE(),
      Key: { discordUserId },
      UpdateExpression: "SET meleeUserIdentity = :m REMOVE pendingClaim",
      // Binds the exact claimed value so approval is atomic: if the pending
      // claim changed between the read above and this write, this fails.
      ConditionExpression: "pendingClaim = :m",
      ExpressionAttributeValues: { ":m": account.pendingClaim },
    }));
    return;
  }

  await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    UpdateExpression: "REMOVE pendingClaim",
    ConditionExpression: "attribute_exists(pendingClaim)",
  }));
}
