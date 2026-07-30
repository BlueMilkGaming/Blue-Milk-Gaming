import test from "node:test";
import assert from "node:assert/strict";
import { missingCredits, placementEntryId } from "./ledger.ts";

const plc = (meleeId: number, meleeUserIdentity: string, currencyPointsAwarded: number) => ({
  meleeId, meleeUserIdentity, currencyPointsAwarded,
});

test("credits every uncredited placement for the identity", () => {
  const owed = missingCredits(
    [plc(101, "m1", 250), plc(102, "m1", 100)], "m1", new Set(),
  );
  assert.deepEqual(owed, [
    { meleeId: 101, amount: 250 },
    { meleeId: 102, amount: 100 },
  ]);
});

test("other identities' placements are not mine", () => {
  assert.deepEqual(missingCredits([plc(101, "m2", 250)], "m1", new Set()), []);
});

test("an existing plc- entry means that tournament is already paid", () => {
  const owed = missingCredits(
    [plc(101, "m1", 250), plc(102, "m1", 100)], "m1", new Set([placementEntryId(101)]),
  );
  assert.deepEqual(owed, [{ meleeId: 102, amount: 100 }]);
});

test("zero-currency placements write no entry", () => {
  assert.deepEqual(missingCredits([plc(101, "m1", 0)], "m1", new Set()), []);
});
