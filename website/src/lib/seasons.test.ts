// node --test src/lib/seasons.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEASONS, CURRENT_SEASON, seasonFor } from "./seasons.ts";

test("every Online Local from 1 up maps to exactly one season", () => {
  for (let n = 1; n <= 40; n++) {
    const matches = SEASONS.filter(
      (s) => n >= s.firstLocal && (s.lastLocal === null || n <= s.lastLocal),
    );
    assert.equal(matches.length, 1, `Online Local #${n} matched ${matches.length} seasons`);
  }
});

test("season boundaries land where ADR 0004 says", () => {
  assert.equal(seasonFor(1)?.id, "s1");
  assert.equal(seasonFor(9)?.id, "s1");
  assert.equal(seasonFor(10)?.id, "s2");
  assert.equal(seasonFor(20)?.id, "s2");
  assert.equal(seasonFor(21)?.id, "s3");
  assert.equal(seasonFor(28)?.id, "s3"); // still open
  assert.equal(CURRENT_SEASON.id, "s3");
});

test("no gaps or overlaps between consecutive seasons", () => {
  for (let i = 1; i < SEASONS.length; i++) {
    assert.equal(SEASONS[i].firstLocal, SEASONS[i - 1].lastLocal! + 1);
  }
  assert.equal(CURRENT_SEASON.lastLocal, null, "the newest season must be open-ended");
});
