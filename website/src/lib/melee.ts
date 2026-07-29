// melee.gg read-only client. See docs/melee-api.md.
//
// PRIVACY: standings responses carry real names, DCI numbers, Arena/MTGO
// handles, and pronouns. Everything past the melee player ID, display name and
// competitive result is dropped *here*, at the boundary, so no caller can
// persist or log it by accident. Do not widen the exported types.

const BASE = "https://melee.gg/api";

// Only events named exactly like this feed the leaderboard. The account also
// sees Sealed, Draft, Patreon, Showdown and GC Draft events.
const ONLINE_LOCAL = /^BMG Online Local #(\d+)$/;

export type Tournament = {
  meleeId: number;
  name: string;
  localNumber: number;
  status: string;
  lastPairDate: string;
};

export type Placement = {
  /**
   * Account-level UUID, stable across tournaments and across username changes.
   * This is the identity anchor.
   *
   * It is NOT the `ID` on a standings row: that is a per-tournament
   * registration ID which changes every event. Melee also lets players change
   * their username every 28 days, so `Username` is not an anchor either.
   * `UserIdentity` only appears on /api/player/list, hence the join below.
   */
  meleeUserIdentity: string;
  /** Per-tournament registration ID. Kept only for tracing a row back to melee. */
  meleeRegistrationId: number;
  displayName: string;
  finishRank: number;
  recordWins: number;
  recordLosses: number;
};

type Envelope<T> = { Content: T[]; HasMore: boolean; RecordsTotal: number };

// Connect timeouts to melee.gg happen intermittently — several times over a
// single backfill. Retries live here rather than in callers so every request
// gets them, and they back off rather than hammering: melee warns that
// excessive requests can get credentials revoked (ADR 0004).
const ATTEMPTS = 3;
const BACKOFF_MS = 1000;

// Exported for the self-check; not part of the public surface otherwise.
export function isWorthRetrying(err: unknown): boolean {
  // 4xx means the request itself is wrong (bad auth, no permission, missing
  // tournament). Retrying cannot fix it and only spends goodwill.
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
  return true; // network-level: timeout, reset, DNS
}

export class HttpError extends Error {
  // A plain field, not a constructor parameter property: those need real TS
  // transformation, and these files run under node's strip-only mode.
  status: number;

  constructor(status: number, path: string, statusText: string) {
    super(`melee ${path} -> ${status} ${statusText}`);
    this.status = status;
  }
}

async function get<T>(path: string, page = 1, pageSize = 50): Promise<Envelope<T>> {
  const id = process.env.MELEE_CLIENT_ID;
  const secret = process.env.MELEE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("MELEE_CLIENT_ID / MELEE_CLIENT_SECRET not set");

  // ignoreCache stays false: melee caches server-side and honoring it is the
  // cheapest way to respect their load guidance.
  const url = `${BASE}${path}?variables.page=${page}&variables.pageSize=${pageSize}`;
  const auth = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Authorization: auth } });
      if (!res.ok) throw new HttpError(res.status, path, res.statusText);
      return await res.json();
    } catch (err) {
      if (attempt >= ATTEMPTS || !isWorthRetrying(err)) throw err;
      const wait = BACKOFF_MS * 2 ** (attempt - 1);
      const why = err instanceof Error ? err.message : String(err);
      console.warn(`melee ${path} attempt ${attempt}/${ATTEMPTS} failed (${why}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function getAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const body = await get<T>(path, page);
    out.push(...body.Content);
    if (!body.HasMore) return out;
  }
}

/** Every Online Local the credentials can see, oldest first. */
export async function listOnlineLocals(): Promise<Tournament[]> {
  type Raw = { ID: number; Name: string; StatusDescription: string; LastPairDateTime: string };
  const raw = await getAll<Raw>("/tournament/list");
  return raw
    .flatMap((t) => {
      const m = ONLINE_LOCAL.exec(t.Name ?? "");
      if (!m) return [];
      return [{
        meleeId: t.ID,
        name: t.Name,
        localNumber: Number(m[1]),
        status: t.StatusDescription,
        lastPairDate: (t.LastPairDateTime ?? "").slice(0, 10),
      }];
    })
    .sort((a, b) => a.localNumber - b.localNumber);
}

/**
 * Registration ID -> account UUID, for one tournament.
 *
 * PRIVACY: this endpoint is far leakier than standings. It also returns Email,
 * WizardsAccountEmail, PlayerName, Bio, and social handles. Only three fields
 * escape this function.
 */
async function getIdentities(meleeTournamentId: number): Promise<Map<number, string>> {
  type RawEntrant = { ID: number; UserIdentity?: string };
  const entrants = await getAll<RawEntrant>(`/player/list/${meleeTournamentId}`);
  const identities = new Map<number, string>();
  for (const entrant of entrants) {
    if (entrant.UserIdentity) identities.set(entrant.ID, entrant.UserIdentity);
  }
  return identities;
}

/** Final standings, stripped to what the leaderboard is allowed to keep. */
export async function getStandings(meleeTournamentId: number): Promise<Placement[]> {
  type RawPlayer = { ID: number; DisplayName?: string; Username?: string };
  type RawRow = {
    Rank: number;
    MatchWins: number;
    MatchLosses: number;
    Team?: { Players?: RawPlayer[] };
  };

  const [rows, identities] = await Promise.all([
    getAll<RawRow>(`/standing/list/current/${meleeTournamentId}`),
    getIdentities(meleeTournamentId),
  ]);

  return rows.map((row) => {
    // Standings are team-shaped even for singles. A multi-player team means
    // this is not a singles event and must not be attributed to one person.
    const players = row.Team?.Players ?? [];
    if (players.length !== 1) {
      throw new Error(
        `tournament ${meleeTournamentId} rank ${row.Rank}: expected 1 player, got ${players.length}`,
      );
    }
    const p = players[0];
    const userIdentity = identities.get(p.ID);
    // Fail rather than fall back to the registration ID: a silent fallback
    // would quietly create a duplicate player every week, which is exactly the
    // bug this join exists to fix.
    if (!userIdentity) {
      throw new Error(
        `tournament ${meleeTournamentId} rank ${row.Rank}: no UserIdentity for registration ${p.ID}`,
      );
    }
    return {
      meleeUserIdentity: userIdentity,
      meleeRegistrationId: p.ID,
      // Many players set DisplayName to their real name. Publish it as-is —
      // it is the name they chose to compete under. Do not add filtering here;
      // the rule is that FirstName/LastName/Name never leave this function,
      // not that the value can't look like a legal name. See ADR 0004.
      displayName: p.DisplayName || p.Username || `player-${p.ID}`,
      finishRank: row.Rank,
      recordWins: row.MatchWins,
      recordLosses: row.MatchLosses,
    };
  });
}
