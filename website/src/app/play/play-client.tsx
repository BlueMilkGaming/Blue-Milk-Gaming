"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { joinAction, leaveAction, reportAction, flagAction, fireAction } from "./actions";
import { NO_SHOW_CLAIM_MS, LOBBY_TTL_MS, POD_MIN, POD_ROUNDS, type Match, type PodRow, type Seat } from "@/lib/pods";

type Snapshot = {
  lobby: { podId: string; seats: string[]; createdAt: string } | null;
  playingCount: number;
  you: (Omit<PodRow, "seatIds"> & { seatIds?: undefined }) | null;
  yourId: string | null;
  paidToday: number;
};

const POLL_MS = 7000;

export function PlayClient() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [lastPod, setLastPod] = useState<Snapshot["you"]>(null); // done-screen memory
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const prevYou = useRef<Snapshot["you"]>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pod", { cache: "no-store" });
      const next: Snapshot = await res.json();
      if (prevYou.current && !next.you) {
        // The pod closed under us. The snapshot we hold predates the final
        // report, so fetch the closed pod's real state for the summary.
        try {
          const res = await fetch(`/api/pod?id=${prevYou.current.podId}`, { cache: "no-store" });
          const { pod } = await res.json();
          if (pod?.status === "done") setLastPod(pod);
          else if (!pod && prevYou.current.status === "playing") setLastPod(prevYou.current);
        } catch {
          if (prevYou.current.status === "playing") setLastPod(prevYou.current);
        }
      }
      prevYou.current = next.you;
      setSnap(next);
    } catch {
      // A dropped poll is fine; the next tick retries.
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh]);

  const act = (work: () => Promise<{ error: string } | { ok: true }>) =>
    startTransition(async () => {
      setError("");
      const result = await work();
      if ("error" in result) setError(result.error);
      await refresh();
    });

  if (!snap) return <p className="mt-8 font-extrabold text-[color-mix(in_srgb,var(--paper)_70%,transparent)]">Setting the table…</p>;

  const you = snap.you;
  return (
    <div className="mt-8 space-y-6">
      {error && (
        <p className="tilt-r inline-block bg-[var(--hot)] px-4 py-2 font-extrabold text-[var(--ink)]">{error}</p>
      )}
      {you?.status === "filling" && <Lobby pod={you} yourId={snap.yourId!}
        onLeave={() => act(() => leaveAction(you.podId))}
        onFire={() => act(() => fireAction(you.podId))}
        pending={pending} />}
      {you?.status === "playing" && <Playing pod={you} yourId={snap.yourId!} act={act} pending={pending} />}
      {!you && lastPod && <Finished pod={lastPod} yourId={snap.yourId!} paidToday={snap.paidToday} onAgain={() => { setLastPod(null); act(joinAction); }} pending={pending} />}
      {!you && !lastPod && <PlayNow snap={snap} onJoin={() => act(joinAction)} pending={pending} />}
    </div>
  );
}

function PlayNow({ snap, onJoin, pending }: { snap: Snapshot; onJoin: () => void; pending: boolean }) {
  return (
    <div className="tilt-l taped paper p-8">
      <h1 className="display text-4xl">Play now</h1>
      <p className="mt-4 leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
        {snap.lobby
          ? `A table is filling: ${snap.lobby.seats.length} of 8 chairs taken. A full 8 deals itself; the host can launch with 4 or 6.`
          : "Tables are quiet right now. First pod of the day opens when you sit down."}
        {snap.playingCount > 0 && ` ${snap.playingCount} pod${snap.playingCount > 1 ? "s" : ""} in play.`}
      </p>
      <p className="mt-3 font-extrabold">Three Rounds, Best of 1. Should take about an hour.</p>
      <p className="nums mt-3 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
        Earned today: {snap.paidToday} points. Your best two pods each day pay out.
      </p>
      <button onClick={onJoin} disabled={pending}
        className="mt-6 cursor-pointer rounded-full bg-[var(--hot)] px-8 py-3 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:opacity-50">
        {snap.lobby ? "Pull up a chair" : "Open a table"}
      </button>
    </div>
  );
}

function SeatAvatar({ seat }: { seat: Seat }) {
  if (!seat.avatar) {
    return (
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-extrabold text-[var(--ink)]">
        {seat.displayName.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images.unoptimized is set; Discord CDN serves the sized file
    <img src={`https://cdn.discordapp.com/avatars/${seat.playerId}/${seat.avatar}.png?size=64`}
      alt="" className="h-8 w-8 shrink-0 rounded-full" />
  );
}

function Lobby({ pod, yourId, onLeave, onFire, pending }: {
  pod: NonNullable<Snapshot["you"]>; yourId: string;
  onLeave: () => void; onFire: () => void; pending: boolean;
}) {
  const minutesLeft = Math.max(0, Math.ceil((Date.parse(pod.createdAt) + LOBBY_TTL_MS - Date.now()) / 60000));
  const host = pod.seats[0];
  const isHost = host?.playerId === yourId;
  const canFire = pod.seats.length >= POD_MIN && pod.seats.length % 2 === 0;
  return (
    <div className="tilt-l taped paper p-8">
      <h1 className="display text-4xl">Filling: {pod.seats.length} of 8</h1>
      <ul className="nums mt-5 grid grid-cols-2 gap-2">
        {pod.seats.map((s) => (
          <li key={s.playerId} className="flex items-center gap-2.5 border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2 font-extrabold">
            <SeatAvatar seat={s} />
            <span>
              {s.displayName}
              {s.playerId === yourId && " (you)"}
              {s.playerId === host?.playerId && " (host)"}
            </span>
          </li>
        ))}
        {Array.from({ length: 8 - pod.seats.length }, (_, i) => (
          <li key={`empty-${i}`} className="border-b-2 border-dashed border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2 font-extrabold text-[color-mix(in_srgb,var(--ink)_35%,transparent)]">
            open chair
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
        The table clears in {minutesLeft} min if it doesn&apos;t fill. A full 8
        deals itself, or the host can launch with 4 or 6.
      </p>
      {canFire && isHost && (
        <button onClick={onFire} disabled={pending}
          className="mt-5 cursor-pointer rounded-full bg-[var(--hot)] px-6 py-2.5 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:opacity-50">
          Launch with {pod.seats.length} players
        </button>
      )}
      {canFire && !isHost && (
        <p className="mt-4 text-sm font-extrabold">
          {host.displayName} can launch the pod now, or you can wait for more players.
        </p>
      )}
      <button onClick={onLeave} disabled={pending}
        className="mt-5 ml-0 block cursor-pointer text-sm font-extrabold underline transition-colors hover:text-[var(--accent)]">
        Stand up
      </button>
    </div>
  );
}

function Playing({ pod, yourId, act, pending }: {
  pod: NonNullable<Snapshot["you"]>; yourId: string;
  act: (work: () => Promise<{ error: string } | { ok: true }>) => void; pending: boolean;
}) {
  const roundIndex = pod.rounds.length - 1;
  const round = pod.rounds[roundIndex];
  const matchIndex = round.pairings.findIndex((m) => m.a === yourId || m.b === yourId);
  const match = round.pairings[matchIndex];
  const names = new Map(pod.seats.map((s) => [s.playerId, s.displayName]));
  const nameOf = (id: string) => names.get(id) ?? "?";
  const noShowOpen = Date.now() - Date.parse(round.dealtAt) >= NO_SHOW_CLAIM_MS;

  // A round advances the instant its last result lands, so a false report
  // there can close the flag window before the victim ever sees it on the
  // current-round card. Surface prior rounds' own matches too.
  const priorOwnMatches = pod.rounds.slice(0, roundIndex).flatMap((r, ri) => {
    const mi = r.pairings.findIndex((m) => m.a === yourId || m.b === yourId);
    return mi === -1 ? [] : [{ roundIndex: ri, matchIndex: mi, match: r.pairings[mi] }];
  });

  return (
    <div className="space-y-6">
      <div className="tilt-l taped paper p-8">
        <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--ink)_65%,transparent)]">
          Round {roundIndex + 1} of {POD_ROUNDS}
        </p>
        <h1 className="display mt-2 text-4xl">Your match</h1>
        {match ? <MatchCard match={match} yourId={yourId} nameOf={nameOf} noShowOpen={noShowOpen}
          onReport={(winner, noShow) => act(() => reportAction(pod.podId, roundIndex, matchIndex, winner, noShow))}
          onFlag={() => act(() => flagAction(pod.podId, roundIndex, matchIndex))}
          pending={pending} />
          : <p className="mt-4 font-extrabold">No match for you this round.</p>}
        <p className="mt-5 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
          Coordinate in Discord, play however your pod prefers, report here when you&apos;re done.
        </p>
      </div>
      {priorOwnMatches.length > 0 && (
        <div className="tilt-r paper p-6">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
            Your earlier rounds
          </p>
          <div className="mt-3 space-y-4">
            {priorOwnMatches.map(({ roundIndex: ri, matchIndex: mi, match: m }) => (
              <div key={ri}>
                <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--ink)_50%,transparent)]">
                  Round {ri + 1}
                </p>
                <MatchCard match={m} yourId={yourId} nameOf={nameOf} noShowOpen={false}
                  onReport={() => {}} onFlag={() => act(() => flagAction(pod.podId, ri, mi))}
                  pending={pending} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="tilt-r paper p-6">
        <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
          The other tables
        </p>
        <ul className="nums mt-3 space-y-1.5 text-sm font-extrabold">
          {round.pairings.map((m, i) => i !== matchIndex && (
            <li key={i}>
              {nameOf(m.a)} vs {nameOf(m.b)}: {m.winner ? `${nameOf(m.winner)} won` : "playing"}
              {m.flaggedBy && !m.flagResolution && " (flagged)"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MatchCard({ match, yourId, nameOf, noShowOpen, onReport, onFlag, pending }: {
  match: Match; yourId: string; nameOf: (id: string) => string; noShowOpen: boolean;
  onReport: (winner: string, noShow: boolean) => void; onFlag: () => void; pending: boolean;
}) {
  const opponent = match.a === yourId ? match.b : match.a;
  if (!match.winner) {
    return (
      <div className="mt-4">
        <p className="text-xl font-extrabold">vs {nameOf(opponent)}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => onReport(yourId, false)} disabled={pending}
            className="cursor-pointer rounded-full bg-[var(--hot)] px-5 py-2.5 font-extrabold text-[var(--ink)] disabled:opacity-50">
            I won
          </button>
          <button onClick={() => onReport(opponent, false)} disabled={pending}
            className="cursor-pointer rounded-full border-2 border-[var(--ink)] px-5 py-2.5 font-extrabold disabled:opacity-50">
            They won
          </button>
          {noShowOpen && (
            <button onClick={() => onReport(yourId, true)} disabled={pending}
              className="cursor-pointer px-2 py-2.5 text-sm font-extrabold underline">
              Claim a no-show win
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-xl font-extrabold">
        vs {nameOf(opponent)}: {nameOf(match.winner)} won{match.noShow && " (no-show)"}
      </p>
      {match.flaggedBy && !match.flagResolution ? (
        <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
          Flagged. The pod keeps moving; this match&apos;s points wait for the shopkeeper.
        </p>
      ) : !match.flaggedBy && match.reportedBy !== yourId && (
        <button onClick={onFlag} disabled={pending}
          className="mt-2 cursor-pointer text-sm font-extrabold underline">
          That&apos;s not what happened
        </button>
      )}
    </div>
  );
}

function Finished({ pod, yourId, paidToday, onAgain, pending }: {
  pod: NonNullable<Snapshot["you"]>; yourId: string; paidToday: number; onAgain: () => void; pending: boolean;
}) {
  const wins = pod.rounds.flatMap((r) => r.pairings).filter((m) => m.winner === yourId).length;
  const losses = pod.rounds.flatMap((r) => r.pairings)
    .filter((m) => (m.a === yourId || m.b === yourId) && m.winner && m.winner !== yourId).length;
  return (
    <div className="tilt-l taped paper p-8">
      <h1 className="display text-4xl">Pod finished</h1>
      <p className="nums mt-4 text-xl font-extrabold">You went {wins}-{losses}.</p>
      <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
        Earned today: {paidToday} points. Wins pay toward the prize wall; your
        best two pods each day count.
      </p>
      <button onClick={onAgain} disabled={pending}
        className="mt-6 cursor-pointer rounded-full bg-[var(--hot)] px-8 py-3 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:opacity-50">
        Sit down again
      </button>
    </div>
  );
}
