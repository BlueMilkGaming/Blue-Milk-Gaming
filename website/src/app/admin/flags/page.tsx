import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { unresolvedFlags } from "@/lib/pods-db";
import { clubDay } from "@/lib/pods";
import { StoreStyles } from "../../store-styles";
import { AdminNav } from "../admin-nav";
import { FlagActions } from "./flag-actions";

export const dynamic = "force-dynamic";

// Flags live on recent pods; a week of days covers any realistic dispute.
const LOOKBACK_DAYS = 7;

export default async function FlagsPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const days = Array.from({ length: LOOKBACK_DAYS }, (_, i) =>
    clubDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const flags = await unresolvedFlags(days);
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin/flags" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Flags</h1>
          {flags.length === 0 && <p className="mt-4 font-extrabold">Queue&apos;s empty.</p>}
          <ul className="mt-4 space-y-5">
            {flags.map(({ pod, roundIndex, matchIndex }) => {
              const match = pod.rounds[roundIndex].pairings[matchIndex];
              const names = new Map(pod.seats.map((s) => [s.playerId, s.displayName]));
              const nameOf = (id?: string) => (id && names.get(id)) ?? "?";
              return (
                <li key={`${pod.podId}-${roundIndex}-${matchIndex}`}
                  className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4">
                  <p className="font-extrabold">
                    {nameOf(match.a)} vs {nameOf(match.b)}, round {roundIndex + 1}
                    {match.noShow && " (no-show claim)"}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                    Reported: {nameOf(match.winner)} won (by {nameOf(match.reportedBy)}).
                    Flagged by {nameOf(match.flaggedBy)}. Pod {pod.status}, {pod.day}.
                  </p>
                  <FlagActions podId={pod.podId} roundIndex={roundIndex} matchIndex={matchIndex} />
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
