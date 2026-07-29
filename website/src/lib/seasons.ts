// Season boundaries (ADR 0004). Seasons follow SWU set releases, and event
// counts vary, so nothing may assume a fixed length.
//
// These are defined by Online Local number rather than by date because that is
// how they actually break: the weekly cadence pauses between sets, and the
// numbering is contiguous with no gaps. A date range would need re-tuning every
// time an event moves a week; a number range does not.
//
// This is a code constant rather than a DynamoDB table on purpose. The ADR asks
// for editable data, not derived data — and with no admin UI yet, a table would
// have exactly the same edit friction as this file plus an extra table to read.
// Move it into Dynamo when an admin can actually edit it.

export type Season = {
  id: string;
  name: string;
  set: string;
  firstLocal: number;
  /** null means the season is still running. */
  lastLocal: number | null;
};

export const SEASONS: Season[] = [
  { id: "s1", name: "Season 1", set: "Set 6 (SEC)", firstLocal: 1, lastLocal: 9 },
  { id: "s2", name: "Season 2", set: "Set 7 (LAW)", firstLocal: 10, lastLocal: 20 },
  { id: "s3", name: "Season 3", set: "Set 8 (ASH)", firstLocal: 21, lastLocal: null },
];

export const CURRENT_SEASON = SEASONS[SEASONS.length - 1];

export function seasonFor(localNumber: number): Season | undefined {
  return SEASONS.find(
    (s) => localNumber >= s.firstLocal && (s.lastLocal === null || localNumber <= s.lastLocal),
  );
}

export function getSeason(id: string): Season | undefined {
  return SEASONS.find((s) => s.id === id);
}
