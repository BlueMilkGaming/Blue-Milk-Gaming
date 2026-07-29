import test from "node:test";
import assert from "node:assert/strict";
import { claimError, approvalError, type AccountRow } from "./accounts.ts";

const acct = (over: Partial<AccountRow> = {}): AccountRow => ({
  discordUserId: "d1",
  displayName: "Player One",
  createdAt: "2026-07-29T00:00:00Z",
  ...over,
});

test("fresh account may claim an unclaimed identity", () => {
  assert.equal(claimError(acct(), new Set(), "m-uuid-1"), null);
});

test("no account row yet is fine (created on demand)", () => {
  assert.equal(claimError(undefined, new Set(), "m-uuid-1"), null);
});

test("already linked accounts cannot claim again", () => {
  assert.match(claimError(acct({ meleeUserIdentity: "m0" }), new Set(), "m1")!, /already linked/);
});

test("an identity claimed by someone else is taken", () => {
  assert.match(claimError(acct(), new Set(["m1"]), "m1")!, /taken/);
});

test("a pending claim blocks a second request", () => {
  assert.match(claimError(acct({ pendingClaim: "m2" }), new Set(), "m1")!, /pending/);
});

test("identity already held by another account → approval refuses", () => {
  const myAccount = acct({ discordUserId: "d1", pendingClaim: "m1" });
  const otherAccount = acct({ discordUserId: "d2", displayName: "Player Two", meleeUserIdentity: "m1" });
  assert.match(approvalError(myAccount, [otherAccount])!, /held by another/);
});
