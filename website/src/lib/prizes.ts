// Prize wall domain types and guards (redemption spec 2026-07-30). The
// catalog is code (src/data/prize-wall.ts); Dynamo holds only mutable state.
import { PRIZE_WALL, type PrizeWallItem } from "../data/prize-wall.ts";

/** Mutable per-item state. A stock attribute means finite; absent means unlimited. */
export type PrizeRow = { prizeId: string; stock?: number; hidden?: boolean };

export type RedemptionRow = {
  playerId: string;        // Discord snowflake
  redemptionId: string;    // ULID
  prizeId: string;
  displayName: string;     // snapshot at request time, for the admin queue
  costAtRedemption: number; // snapshot: repricing never rewrites what was paid
  status: "pending" | "fulfilled" | "cancelled";
  requestedAt: string;
  fulfilledAt?: string;
  note?: string;
};

export function prizeById(prizeId: string): PrizeWallItem | undefined {
  return PRIZE_WALL.find((p) => p.id === prizeId);
}

/** Why this redemption is not allowed, or null if it is. Pure; caller supplies state. */
export function redeemError(
  item: PrizeWallItem | undefined,
  row: PrizeRow | undefined,
  balance: number,
  linked: boolean,
): string | null {
  if (!item || row?.hidden) return "That item is not on the wall.";
  if (!linked) return "Link your melee results on your card first.";
  if (row?.stock !== undefined && row.stock <= 0) return "Sold out.";
  if (balance < item.points) return "Not enough points.";
  return null;
}
