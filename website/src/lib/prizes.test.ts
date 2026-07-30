import test from "node:test";
import assert from "node:assert/strict";
import { PRIZE_WALL } from "../data/prize-wall.ts";
import { redeemError, type PrizeRow } from "./prizes.ts";

test("catalog ids are unique, kebab-case slugs", () => {
  const ids = PRIZE_WALL.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

const item = PRIZE_WALL[0]; // any real item works; guards only read .points
const row = (over: Partial<PrizeRow> = {}): PrizeRow => ({ prizeId: item.id, ...over });

test("unknown item is not on the wall", () => {
  assert.match(redeemError(undefined, undefined, 99999, true)!, /not on the wall/);
});

test("hidden item is not on the wall", () => {
  assert.match(redeemError(item, row({ hidden: true }), 99999, true)!, /not on the wall/);
});

test("unlinked players must link first", () => {
  assert.match(redeemError(item, undefined, 99999, false)!, /[Ll]ink/);
});

test("a zero-stock item is sold out", () => {
  assert.match(redeemError(item, row({ stock: 0 }), 99999, true)!, /Sold out/);
});

test("a short balance cannot redeem, even on an unlimited item", () => {
  assert.match(redeemError(item, undefined, item.points - 1, true)!, /Not enough points/);
});

test("linked, funded, in stock: allowed", () => {
  assert.equal(redeemError(item, row({ stock: 3 }), item.points, true), null);
});

test("no Prize row means unlimited: allowed", () => {
  assert.equal(redeemError(item, undefined, item.points, true), null);
});
