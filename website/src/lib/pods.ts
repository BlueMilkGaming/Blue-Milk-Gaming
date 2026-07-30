// Pod domain logic (pods spec, Stage 2). Pure functions only; Dynamo I/O
// lives in pods-db.ts so this whole file runs under node --test.
import { PODS_V1 } from "./scoring.ts";

export const POD_SIZE = 8;
export const POD_ROUNDS = 3;
export const POD_MIN = 4;
export const LOBBY_TTL_MS = 60 * 60 * 1000;      // filling > 60 min → abandoned
export const POD_TTL_MS = 4 * 60 * 60 * 1000;    // playing > 4 h → done as-is
export const NO_SHOW_CLAIM_MS = 30 * 60 * 1000;  // claimable 30 min into a round
export const LFG_PING_COOLDOWN_MS = 60 * 60 * 1000; // one @LFG ping per hour

export type Seat = { playerId: string; displayName: string; joinedAt: string; avatar?: string | null };
export type Match = {
  a: string;
  b: string;
  winner?: string;
  reportedBy?: string;
  noShow?: boolean;
  flaggedBy?: string;
  flagResolution?: "uphold" | "overturn" | "void";
};
export type Round = { pairings: Match[]; dealtAt: string };
export type PodStatus = "filling" | "playing" | "done" | "abandoned";
export type PodRow = {
  podId: string;
  status: PodStatus;
  day: string;           // club-timezone calendar day of creation (byDay GSI)
  seats: Seat[];
  seatIds: Set<string>;  // parallel to seats: what conditional writes check
  rounds: Round[];
  createdAt: string;
  filledAt?: string;
  closedAt?: string;
  announceMessageId?: string; // Discord message edited across the pod's lifetime
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export function winsByPlayer(rounds: Round[]): Map<string, number> {
  const wins = new Map<string, number>();
  for (const round of rounds)
    for (const match of round.pairings)
      if (match.winner) wins.set(match.winner, (wins.get(match.winner) ?? 0) + 1);
  return wins;
}

/** Every way to split the ids into pairs. 8 players → 7·5·3·1 = 105. */
export function allMatchings(ids: string[]): [string, string][][] {
  if (ids.length === 0) return [[]];
  const [first, ...rest] = ids;
  const out: [string, string][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of allMatchings(remaining)) out.push([[first, rest[i]], ...sub]);
  }
  return out;
}

/**
 * Round 1 is random; later rounds score all 105 matchings (penalty per win of
 * record mismatch, large penalty per rematch) and take the best. `rng` is
 * injectable for tests.
 */
export function dealRound(
  seats: Seat[],
  priorRounds: Round[],
  rng: () => number = Math.random,
): Match[] {
  const ids = seats.map((s) => s.playerId);
  if (priorRounds.length === 0) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const pairings: Match[] = [];
    for (let i = 0; i < ids.length; i += 2) pairings.push({ a: ids[i], b: ids[i + 1] });
    return pairings;
  }

  const wins = winsByPlayer(priorRounds);
  const played = new Set(priorRounds.flatMap((r) => r.pairings.map((m) => pairKey(m.a, m.b))));
  // Dwarfs any possible sum of record mismatches (at most 3 wins × 4 pairs).
  const REMATCH_PENALTY = 100;
  let best: [string, string][] = [];
  let bestScore = Infinity;
  for (const matching of allMatchings(ids)) {
    let score = 0;
    for (const [a, b] of matching) {
      score += Math.abs((wins.get(a) ?? 0) - (wins.get(b) ?? 0));
      if (played.has(pairKey(a, b))) score += REMATCH_PENALTY;
    }
    if (score < bestScore) {
      bestScore = score;
      best = matching;
    }
  }
  return best.map(([a, b]) => ({ a, b }));
}

export function roundComplete(round: Round): boolean {
  return round.pairings.every((m) => m.winner);
}

/**
 * The club's calendar day (the Online Local runs 6:30 PM CT). An evening of pods must not
 * split across a UTC midnight, or the best-2-per-day cap would loosen mid-session.
 */
export function clubDay(at: Date = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** The status this pod should have at `now`; readers apply the change lazily. */
export function effectiveStatus(pod: PodRow, now: Date = new Date()): PodStatus {
  const since = pod.status === "filling" ? pod.createdAt : (pod.filledAt ?? pod.createdAt);
  const age = now.getTime() - Date.parse(since);
  if (pod.status === "filling" && age > LOBBY_TTL_MS) return "abandoned";
  if (pod.status === "playing" && age > POD_TTL_MS) return "done";
  return pod.status;
}

/**
 * Points still owed for today: the value of the best `bestPodsPerDay` pods
 * minus what today already paid. Never negative; nothing is clawed back.
 */
export function settleUp(
  todaysPodWins: number[],
  alreadyPaidToday: number,
  winValue: number = PODS_V1.winCurrency,
): number {
  const best = [...todaysPodWins].sort((a, b) => b - a).slice(0, PODS_V1.bestPodsPerDay);
  const owed = best.reduce((sum, wins) => sum + wins * winValue, 0);
  return Math.max(0, owed - alreadyPaidToday);
}

/** Split a settle-up delta into per-win ledger amounts, capped per win. */
export function perWinDeltas(
  unfrozenWinCount: number,
  delta: number,
  winValue: number = PODS_V1.winCurrency,
): number[] {
  const deltas: number[] = [];
  let remaining = delta;
  for (let i = 0; i < unfrozenWinCount && remaining > 0; i++) {
    const amount = Math.min(winValue, remaining);
    deltas.push(amount);
    remaining -= amount;
  }
  return deltas;
}

/** This player's wins whose payout is not frozen by an unresolved flag. */
export function unfrozenWins(
  rounds: Round[],
  playerId: string,
): { round: number; match: number }[] {
  const wins: { round: number; match: number }[] = [];
  rounds.forEach((r, roundIndex) =>
    r.pairings.forEach((m, matchIndex) => {
      if (m.winner === playerId && m.flagResolution !== "void" && !(m.flaggedBy && !m.flagResolution))
        wins.push({ round: roundIndex, match: matchIndex });
    }),
  );
  return wins;
}

/** Why this report is not allowed, or null if it is. Pure; caller supplies state. */
export function reportError(
  pod: PodRow,
  playerId: string,
  roundIndex: number,
  matchIndex: number,
  winner: string,
  opts: { noShow?: boolean; now?: Date } = {},
): string | null {
  if (pod.status !== "playing") return "This pod is not in play.";
  if (roundIndex !== pod.rounds.length - 1) return "That round is over.";
  const match = pod.rounds[roundIndex]?.pairings[matchIndex];
  if (!match) return "No such match.";
  if (match.a !== playerId && match.b !== playerId) return "Not your match.";
  if (match.winner) return "Already reported.";
  if (winner !== match.a && winner !== match.b) return "Winner must be one of the two players.";
  if (opts.noShow) {
    if (winner !== playerId) return "A no-show claim awards you the win.";
    const elapsed = (opts.now ?? new Date()).getTime() - Date.parse(pod.rounds[roundIndex].dealtAt);
    if (elapsed < NO_SHOW_CLAIM_MS) return "No-show claims open 30 minutes into the round.";
  }
  return null;
}

/** Why this flag is not allowed, or null if it is. Pure; caller supplies state. */
export function flagError(
  pod: PodRow,
  playerId: string,
  roundIndex: number,
  matchIndex: number,
): string | null {
  if (pod.status !== "playing") return "Flags close when the pod does. Ask in Discord and the shopkeeper can adjust.";
  const match = pod.rounds[roundIndex]?.pairings[matchIndex];
  if (!match) return "No such match.";
  if (match.a !== playerId && match.b !== playerId) return "Not your match.";
  if (!match.winner) return "Nothing reported to flag yet.";
  if (match.reportedBy === playerId) return "You reported this result; only your opponent can flag it.";
  if (match.flaggedBy) return "Already flagged.";
  return null;
}

/** Why this early launch is not allowed, or null if it is. Pure; caller supplies state. */
export function fireError(pod: PodRow, playerId: string): string | null {
  if (pod.status !== "filling") return "This table is not filling.";
  if (pod.seats[0]?.playerId !== playerId) return "Only the host can launch the pod early.";
  const seated = pod.seats.length;
  if (seated < POD_MIN) return `A pod needs at least ${POD_MIN} players.`;
  if (seated % 2 !== 0) return "A pod needs an even number of players.";
  return null;
}

/**
 * Ping @LFG only for the first table of the hour. Join/leave/join spam
 * creates fresh pods, so recent creations (any status) suppress the ping.
 * ponytail: byDay scoping means a 23:50 pod never suppresses a 00:10 ping
 * across club midnight; harmless at this scale.
 */
export function shouldPingLfg(
  todaysPods: { createdAt: string }[],
  now: Date = new Date(),
): boolean {
  return todaysPods.every(
    (p) => now.getTime() - Date.parse(p.createdAt) >= LFG_PING_COOLDOWN_MS,
  );
}
