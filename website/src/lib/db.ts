// DynamoDB access for the leaderboard (ADR 0004).
//
// Three tables. Tournaments key on melee's integer tournament ID; players key
// on melee's account-level UserIdentity UUID, which is the only identifier that
// survives both a new event registration and a username change. Re-importing a
// tournament overwrites the same keys, which is what makes imports idempotent.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { awardFor, CURRENT_SCORING } from "./scoring.ts";
import { seasonFor, getSeason, type Season } from "./seasons.ts";
import type { Placement as MeleePlacement, Tournament as MeleeTournament } from "./melee.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  player: () => Resource.Player.name,
  tournament: () => Resource.Tournament.name,
  placement: () => Resource.Placement.name,
};

export type PlayerRow = {
  meleeUserIdentity: string;
  displayName: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type TournamentRow = {
  meleeId: number;
  name: string;
  localNumber: number;
  seasonId: string;
  completedAt: string;
  playerCount: number;
  scoringVersion: number;
  importedAt: string;
};

export type PlacementRow = {
  meleeId: number;
  meleeUserIdentity: string;
  meleeRegistrationId: number;
  displayName: string;
  finishRank: number;
  rankingPointsAwarded: number;
  currencyPointsAwarded: number;
  recordWins: number;
  recordLosses: number;
};

/** Has this tournament already been imported? `externalId` is the idempotency key. */
export async function getTournament(meleeId: number): Promise<TournamentRow | undefined> {
  const res = await doc.send(new GetCommand({ TableName: TABLES.tournament(), Key: { meleeId } }));
  return res.Item as TournamentRow | undefined;
}

// ponytail: Scan over ~30 tournament rows. Add a seasonId GSI if this ever
// grows past a few hundred, which at ~50 events a year is a decade away.
export async function listTournaments(): Promise<TournamentRow[]> {
  const res = await doc.send(new ScanCommand({ TableName: TABLES.tournament() }));
  return ((res.Items ?? []) as TournamentRow[]).sort((a, b) => a.localNumber - b.localNumber);
}

export async function getPlacements(meleeId: number): Promise<PlacementRow[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLES.placement(),
      KeyConditionExpression: "meleeId = :t",
      ExpressionAttributeValues: { ":t": meleeId },
    }),
  );
  return (res.Items ?? []) as PlacementRow[];
}

async function batchPut(table: string, items: object[]): Promise<void> {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let unprocessed = { [table]: chunk.map((Item) => ({ PutRequest: { Item } })) };
    // BatchWrite can partially succeed; retry only what it hands back.
    for (let attempt = 0; Object.keys(unprocessed).length > 0; attempt++) {
      if (attempt > 5) throw new Error(`batchPut to ${table} still unprocessed after 6 attempts`);
      if (attempt > 0) await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
      const res = await doc.send(new BatchWriteCommand({ RequestItems: unprocessed }));
      unprocessed = (res.UnprocessedItems ?? {}) as typeof unprocessed;
    }
  }
}

/**
 * Import one tournament's final standings. Safe to run twice: the same melee
 * IDs overwrite the same rows, so nothing is double-counted.
 */
export async function importTournament(
  tournament: MeleeTournament,
  standings: MeleePlacement[],
): Promise<TournamentRow> {
  const season = seasonFor(tournament.localNumber);
  if (!season) throw new Error(`no season covers Online Local #${tournament.localNumber}`);

  const now = new Date().toISOString();

  const placements: PlacementRow[] = standings.map((p) => {
    const award = awardFor(p.finishRank);
    return {
      meleeId: tournament.meleeId,
      meleeUserIdentity: p.meleeUserIdentity,
      meleeRegistrationId: p.meleeRegistrationId,
      displayName: p.displayName,
      finishRank: p.finishRank,
      // Awarded points are stored, not recomputed. Changing the scoring table
      // must never rewrite what was actually awarded (ADR 0004).
      rankingPointsAwarded: award.ranking,
      currencyPointsAwarded: award.currency,
      recordWins: p.recordWins,
      recordLosses: p.recordLosses,
    };
  });

  const players: PlayerRow[] = standings.map((p) => ({
    meleeUserIdentity: p.meleeUserIdentity,
    displayName: p.displayName,
    firstSeenAt: tournament.lastPairDate,
    lastSeenAt: tournament.lastPairDate,
  }));

  await batchPut(TABLES.placement(), placements);
  await batchPut(TABLES.player(), players);

  const row: TournamentRow = {
    meleeId: tournament.meleeId,
    name: tournament.name,
    localNumber: tournament.localNumber,
    seasonId: season.id,
    completedAt: tournament.lastPairDate,
    playerCount: standings.length,
    scoringVersion: CURRENT_SCORING.version,
    importedAt: now,
  };
  // Written last, so a crash mid-import leaves the tournament un-recorded and
  // the next run redoes it rather than skipping a half-imported event.
  await doc.send(new PutCommand({ TableName: TABLES.tournament(), Item: row }));
  return row;
}

export type LeaderboardEntry = {
  meleeUserIdentity: string;
  displayName: string;
  rankingPoints: number;
  tournamentsPlayed: number;
  bestFinish: number;
};

/**
 * Season standings, computed by summing placements. `seasonId` of "all-time"
 * sums every season.
 *
 * No aggregate table: at ~50 events a year and tens of players each, this is a
 * scan of ~30 rows plus one query per event, and totals that are always derived
 * can never drift from the placements they came from.
 */
export async function getLeaderboard(seasonId: string): Promise<LeaderboardEntry[]> {
  const all = await listTournaments();
  const inScope = seasonId === "all-time" ? all : all.filter((t) => t.seasonId === seasonId);
  if (seasonId !== "all-time" && !getSeason(seasonId)) throw new Error(`unknown season ${seasonId}`);

  const perEvent = await Promise.all(inScope.map((t) => getPlacements(t.meleeId)));

  const totals = new Map<string, LeaderboardEntry>();
  for (const placement of perEvent.flat()) {
    const entry = totals.get(placement.meleeUserIdentity) ?? {
      meleeUserIdentity: placement.meleeUserIdentity,
      displayName: placement.displayName,
      rankingPoints: 0,
      tournamentsPlayed: 0,
      bestFinish: Infinity,
    };
    entry.rankingPoints += placement.rankingPointsAwarded;
    entry.tournamentsPlayed += 1;
    entry.bestFinish = Math.min(entry.bestFinish, placement.finishRank);
    // Placements snapshot the name used at that event, and `inScope` is in
    // chronological order, so the last write is the most recent name.
    entry.displayName = placement.displayName;
    totals.set(placement.meleeUserIdentity, entry);
  }

  return [...totals.values()].sort(
    (a, b) => b.rankingPoints - a.rankingPoints || a.bestFinish - b.bestFinish,
  );
}

export type { Season };
