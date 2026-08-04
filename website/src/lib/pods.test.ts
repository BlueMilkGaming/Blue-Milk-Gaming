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

test("table 1 seats the top pairing", () => {
  const r1 = round([["p0", "p1", "p0"], ["p2", "p3", "p2"], ["p4", "p5", "p4"], ["p6", "p7", "p6"]]);
  const winners = new Set(["p0", "p2", "p4", "p6"]);
  const [table1, ...rest] = dealRound(seats, [r1]);
  assert.ok(winners.has(table1.a) && winners.has(table1.b), "table 1 must pair two winners");
  assert.ok(rest.some((m) => !winners.has(m.a) && !winners.has(m.b)), "losers seat below");
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

import {
  settleUp, perWinDeltas, unfrozenWins, effectiveStatus,
  reportError, flagError, fireError, shouldPingLfg, clubDay, staleSeats,
  LOBBY_TTL_MS, POD_TTL_MS, NO_SHOW_CLAIM_MS, POD_MIN, LFG_PING_COOLDOWN_MS, SEAT_STALE_MS,
  type PodRow,
} from "./pods.ts";

const pod = (over: Partial<PodRow> = {}): PodRow => ({
  podId: "01TEST", status: "playing", day: "2026-07-29",
  seats, seatIds: new Set(ids), rounds: [], createdAt: "2026-07-29T00:00:00Z",
  filledAt: "2026-07-29T00:10:00Z", ...over,
});

test("settle-up motivating case: 0-3, 0-3, then 3-0 pays as a best pod", () => {
  assert.equal(settleUp([0, 0, 3], 0), 75);
});

test("a later better pod tops up what today already paid", () => {
  assert.equal(settleUp([2], 0), 50);        // first pod of the day
  assert.equal(settleUp([2, 3], 50), 75);    // best two now (3,2)·25 = 125
});

test("a third pod under the cap pays nothing, and nothing is clawed back", () => {
  assert.equal(settleUp([2, 2, 1], 100), 0);
  assert.equal(settleUp([2, 2, 0], 125), 0); // overpaid via adjustment: floor at 0
});

test("perWinDeltas spreads a delta across wins, capped per win", () => {
  assert.deepEqual(perWinDeltas(3, 75), [25, 25, 25]);
  assert.deepEqual(perWinDeltas(2, 25), [25]);   // cap bound mid-pod
  assert.deepEqual(perWinDeltas(3, 0), []);
});

test("a flagged unresolved win is frozen; a resolved one is not", () => {
  const rounds = [round([["p0", "p1", "p0"], ["p2", "p3", "p2"], ["p4", "p5", "p4"], ["p6", "p7", "p6"]])];
  rounds[0].pairings[0].flaggedBy = "p1";
  assert.deepEqual(unfrozenWins(rounds, "p0"), []);
  rounds[0].pairings[0].flagResolution = "uphold";
  assert.deepEqual(unfrozenWins(rounds, "p0"), [{ round: 0, match: 0 }]);
});

test("lazy expiry: stale lobby abandons, stuck pod closes", () => {
  const late = new Date(Date.parse("2026-07-29T00:00:00Z") + LOBBY_TTL_MS + 1);
  assert.equal(effectiveStatus(pod({ status: "filling" }), late), "abandoned");
  const later = new Date(Date.parse("2026-07-29T00:10:00Z") + POD_TTL_MS + 1);
  assert.equal(effectiveStatus(pod({ status: "playing" }), later), "done");
  assert.equal(effectiveStatus(pod({ status: "playing" }), new Date("2026-07-29T01:00:00Z")), "playing");
});

test("report validation: wrong player, double report, stranger winner", () => {
  const p = pod({ rounds: [round([["p0", "p1"], ["p2", "p3"], ["p4", "p5"], ["p6", "p7"]])] });
  assert.equal(reportError(p, "p0", 0, 0, "p0"), null);
  assert.match(reportError(p, "p2", 0, 0, "p0")!, /not your match/i);
  assert.match(reportError(p, "p0", 0, 0, "p9")!, /one of the two/i);
  p.rounds[0].pairings[0].winner = "p1";
  assert.match(reportError(p, "p0", 0, 0, "p0")!, /already reported/i);
});

test("no-show claims open 30 minutes into the round, self-award only", () => {
  const dealt = "2026-07-29T01:00:00Z";
  const p = pod({ rounds: [{ pairings: [{ a: "p0", b: "p1" }, { a: "p2", b: "p3" }, { a: "p4", b: "p5" }, { a: "p6", b: "p7" }], dealtAt: dealt }] });
  const early = new Date(Date.parse(dealt) + NO_SHOW_CLAIM_MS - 1);
  const late = new Date(Date.parse(dealt) + NO_SHOW_CLAIM_MS + 1);
  assert.match(reportError(p, "p0", 0, 0, "p0", { noShow: true, now: early })!, /30 minutes/);
  assert.equal(reportError(p, "p0", 0, 0, "p0", { noShow: true, now: late }), null);
  assert.match(reportError(p, "p0", 0, 0, "p1", { noShow: true, now: late })!, /awards you/i);
});

test("flag validation: only the opponent, only once, only while playing", () => {
  const p = pod({ rounds: [round([["p0", "p1", "p0"], ["p2", "p3", "p2"], ["p4", "p5", "p4"], ["p6", "p7", "p6"]])] });
  p.rounds[0].pairings[0].reportedBy = "p0";
  assert.equal(flagError(p, "p1", 0, 0), null);
  assert.match(flagError(p, "p0", 0, 0)!, /opponent/i);
  assert.match(flagError(p, "p2", 0, 0)!, /not your match/i);
  p.rounds[0].pairings[0].flaggedBy = "p1";
  assert.match(flagError(p, "p1", 0, 0)!, /already flagged/i);
  assert.match(flagError(pod({ status: "done", rounds: p.rounds }), "p1", 0, 0)!, /clos/i);
});

test("clubDay uses the club's timezone, not UTC", () => {
  // 11 PM Central on the 28th is 4 AM UTC on the 29th.
  assert.equal(clubDay(new Date("2026-07-29T04:00:00Z")), "2026-07-28");
});

test("4 players deal a full round robin across three rounds", () => {
  const four = seats.slice(0, 4);
  for (const rng of [() => 0, () => 0.5, () => 0.999]) {
    const rounds: Round[] = [];
    for (let i = 0; i < 3; i++) {
      // Winner choice must not matter: always report the first-listed player.
      const pairings = dealRound(four, rounds, rng).map((m) => ({ ...m, winner: m.a }));
      rounds.push({ pairings, dealtAt: "2026-07-30T00:00:00Z" });
    }
    const met = new Set(rounds.flatMap((r) => r.pairings.map(key)));
    assert.equal(met.size, 6, "every pair meets exactly once (C(4,2) = 6)");
  }
});

test("6 players get three rounds with no rematches", () => {
  const six = seats.slice(0, 6);
  const rounds: Round[] = [];
  for (let i = 0; i < 3; i++) {
    const pairings = dealRound(six, rounds, () => 0.3).map((m) => ({ ...m, winner: m.b }));
    rounds.push({ pairings, dealtAt: "2026-07-30T00:00:00Z" });
  }
  const met = rounds.flatMap((r) => r.pairings.map(key));
  assert.equal(new Set(met).size, 9, "3 rounds x 3 matches, all distinct");
});

test("fireError: host only, even count of at least four, filling only", () => {
  const lobby = (n: number) => pod({ status: "filling", seats: seats.slice(0, n), seatIds: new Set(ids.slice(0, n)) });
  assert.equal(fireError(lobby(4), "p0"), null);
  assert.equal(fireError(lobby(6), "p0"), null);
  assert.match(fireError(lobby(4), "p1")!, /host/i);
  assert.match(fireError(lobby(3), "p0")!, /at least/i);
  assert.match(fireError(lobby(5), "p0")!, /even/i);
  assert.match(fireError(pod({ status: "playing" }), "p0")!, /not filling/i);
});

test("shouldPingLfg: pings when the last table is an hour old, or there is none", () => {
  const now = new Date("2026-07-30T02:00:00Z");
  const at = (msAgo: number) => ({ createdAt: new Date(now.getTime() - msAgo).toISOString() });
  assert.equal(shouldPingLfg([], now), true);
  assert.equal(shouldPingLfg([at(LFG_PING_COOLDOWN_MS + 1)], now), true);
  assert.equal(shouldPingLfg([at(LFG_PING_COOLDOWN_MS - 1)], now), false);
  assert.equal(shouldPingLfg([at(LFG_PING_COOLDOWN_MS + 1), at(60_000)], now), false);
});

test("staleSeats flags only quiet seats in a filling pod", () => {
  const now = new Date("2026-08-02T01:00:00Z");
  const old = new Date(now.getTime() - SEAT_STALE_MS - 1).toISOString();
  const p = pod({
    status: "filling",
    seats: [
      { playerId: "p0", displayName: "Fresh join", joinedAt: now.toISOString() },
      { playerId: "p1", displayName: "Quiet", joinedAt: old },
      { playerId: "p2", displayName: "Heartbeat", joinedAt: old, lastSeenAt: now.toISOString() },
      { playerId: "p3", displayName: "Stale heartbeat", joinedAt: old, lastSeenAt: old },
    ],
  });
  assert.deepEqual(staleSeats(p, now).map((s) => s.playerId), ["p1", "p3"]);
});

test("staleSeats ignores non-filling pods", () => {
  const old = new Date(Date.now() - SEAT_STALE_MS - 1).toISOString();
  const p = pod({
    status: "playing",
    seats: [{ playerId: "p0", displayName: "P0", joinedAt: old }],
  });
  assert.deepEqual(staleSeats(p), []);
});
