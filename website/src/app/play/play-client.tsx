"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { joinAction, leaveAction, reportAction, flagAction } from "./actions";
import { NO_SHOW_CLAIM_MS, LOBBY_TTL_MS, POD_ROUNDS, type Match, type PodRow } from "@/lib/pods";

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
          const done = await fetch(`/api/pod?id=${prevYou.current.podId}`, { cache: "no-store" });
          const { pod } = await done.json();
          setLastPod(pod ?? prevYou.current);
        } catch {
          setLastPod(prevYou.current);
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
      {you?.status === "filling" && <Lobby pod={you} yourId={snap.yourId!} onLeave={() => act(() => leaveAction(you.podId))} pending={pending} />}
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
          ? `A table is filling: ${snap.lobby.seats.length} of 8 chairs taken.`
          : "Tables are quiet right now. First pod of the day opens when you sit down."}
        {snap.playingCount > 0 && ` ${snap.playingCount} pod${snap.playingCount > 1 ? "s" : ""} in play.`}
      </p>
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

function Lobby({ pod, yourId, onLeave, pending }: {
  pod: NonNullable<Snapshot["you"]>; yourId: string; onLeave: () => void; pending: boolean;
}) {
  const minutesLeft = Math.max(0, Math.ceil((Date.parse(pod.createdAt) + LOBBY_TTL_MS - Date.now()) / 60000));
  return (
    <div className="tilt-l taped paper p-8">
      <h1 className="display text-4xl">Filling: {pod.seats.length} of 8</h1>
      <ul className="nums mt-5 grid grid-cols-2 gap-2">
        {pod.seats.map((s) => (
          <li key={s.playerId} className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2 font-extrabold">
            {s.displayName}{s.playerId === yourId && " (you)"}
          </li>
        ))}
        {Array.from({ length: 8 - pod.seats.length }, (_, i) => (
          <li key={`empty-${i}`} className="border-b-2 border-dashed border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2 font-extrabold text-[color-mix(in_srgb,var(--ink)_35%,transparent)]">
            open chair
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
        The table clears in {minutesLeft} min if it doesn&apos;t fill. Deals when the 8th chair is taken.
      </p>
      <button onClick={onLeave} disabled={pending}
        className="mt-5 cursor-pointer text-sm font-extrabold underline transition-colors hover:text-[var(--accent)]">
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
      ) : match.reportedBy !== yourId && (
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
