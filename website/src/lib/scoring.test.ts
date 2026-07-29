// node --test src/lib/scoring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { awardFor, CURRENT_SCORING } from "./scoring.ts";

test("top 8 earn points, 9th and below earn nothing", () => {
  assert.deepEqual(awardFor(1), { ranking: 400, currency: 400 });
  assert.deepEqual(awardFor(4), { ranking: 200, currency: 200 });
  assert.deepEqual(awardFor(8), { ranking: 100, currency: 100 });
  assert.deepEqual(awardFor(9), { ranking: 0, currency: 0 });
  assert.deepEqual(awardFor(120), { ranking: 0, currency: 0 });
});

test("an event pays out 1,500 ranking points", () => {
  const total = Array.from({ length: 8 }, (_, i) => awardFor(i + 1).ranking)
    .reduce((a, b) => a + b, 0);
  assert.equal(total, 1500);
  assert.equal(CURRENT_SCORING.version, 1);
});
