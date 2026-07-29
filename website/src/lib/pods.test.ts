import test from "node:test";
import assert from "node:assert/strict";
import {
  allMatchings, dealRound, roundComplete,
  type Match, type Round, type Seat,
} from "./pods.ts";

const seats: Seat[] = Array.from({ length: 8 }, (_, i) => ({
  playerId: `p${i}`, displayName: `Player ${i}`, joinedAt: "2026-07-29T00:00:00Z",
}));
const ids = seats.map((s) => s.playerId);
const round = (results: [string, string, string?][]): Round => ({
  pairings: results.map(([a, b, winner]) => ({ a, b, winner })),
  dealtAt: "2026-07-29T00:00:00Z",
});
const key = (m: Match) => [m.a, m.b].sort().join("|");

test("8 players have exactly 105 possible pairings", () => {
  assert.equal(allMatchings(ids).length, 105);
});

test("round 1 seats everyone exactly once", () => {
  const pairings = dealRound(seats, [], () => 0.42);
  assert.equal(pairings.length, 4);
  const seen = pairings.flatMap((m) => [m.a, m.b]).sort();
  assert.deepEqual(seen, [...ids].sort());
});

test("round 2 pairs winners with winners", () => {
  const r1 = round([["p0", "p1", "p0"], ["p2", "p3", "p2"], ["p4", "p5", "p4"], ["p6", "p7", "p6"]]);
  const winners = new Set(["p0", "p2", "p4", "p6"]);
  for (const m of dealRound(seats, [r1])) {
    assert.equal(winners.has(m.a), winners.has(m.b), `${m.a} vs ${m.b} crosses records`);
  }
});

test("round 3 never deals a rematch", () => {
  const r1 = round([["p0", "p1", "p0"], ["p2", "p3", "p2"], ["p4", "p5", "p4"], ["p6", "p7", "p6"]]);
  const r2 = round([["p0", "p2", "p0"], ["p4", "p6", "p4"], ["p1", "p3", "p1"], ["p5", "p7", "p5"]]);
  const played = new Set([...r1.pairings, ...r2.pairings].map(key));
  for (const m of dealRound(seats, [r1, r2])) {
    assert.ok(!played.has(key(m)), `rematch ${m.a} vs ${m.b}`);
  }
});

test("roundComplete needs all four winners", () => {
  const r = round([["p0", "p1", "p0"], ["p2", "p3", "p2"], ["p4", "p5", "p4"], ["p6", "p7"]]);
  assert.equal(roundComplete(r), false);
  r.pairings[3].winner = "p6";
  assert.equal(roundComplete(r), true);
});
