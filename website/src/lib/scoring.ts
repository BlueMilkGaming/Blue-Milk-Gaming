// Leaderboard scoring. Lives in code, not a table (ADR 0004): it changes rarely
// and benefits from review. Awarded points are stored on import, never
// recomputed, so changing this table does not rewrite history — bump the
// version and the old tournaments keep their `scoringVersion`.

export type Award = { ranking: number; currency: number };

export const SCORING_V1 = {
  version: 1,
  // Only the top 8 earn points. 1,500 per event.
  placement: {
    1: { ranking: 400, currency: 400 },
    2: { ranking: 300, currency: 300 },
    3: { ranking: 200, currency: 200 },
    4: { ranking: 200, currency: 200 },
    5: { ranking: 100, currency: 100 },
    6: { ranking: 100, currency: 100 },
    7: { ranking: 100, currency: 100 },
    8: { ranking: 100, currency: 100 },
  } as Record<number, Award>,
  // Deferred: values undecided, and it will require finishing all rounds.
  participation: null,
} as const;

export const CURRENT_SCORING = SCORING_V1;

const NOTHING: Award = { ranking: 0, currency: 0 };

/** Points awarded for a finishing rank. 9th and below earn nothing. */
export function awardFor(finishRank: number, scoring = CURRENT_SCORING): Award {
  return scoring.placement[finishRank] ?? NOTHING;
}
