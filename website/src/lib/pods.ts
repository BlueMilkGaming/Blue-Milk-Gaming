// Pod domain logic (pods spec, Stage 2). Pure functions only; Dynamo I/O
// lives in pods-db.ts so this whole file runs under node --test.
import { PODS_V1 } from "./scoring.ts";

export const POD_SIZE = 8;
export const POD_ROUNDS = 3;
export const LOBBY_TTL_MS = 60 * 60 * 1000;      // filling > 60 min → abandoned
export const POD_TTL_MS = 4 * 60 * 60 * 1000;    // playing > 4 h → done as-is
export const NO_SHOW_CLAIM_MS = 30 * 60 * 1000;  // claimable 30 min into a round

export type Seat = { playerId: string; displayName: string; joinedAt: string };
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
