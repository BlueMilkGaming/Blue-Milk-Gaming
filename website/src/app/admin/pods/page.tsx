import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { openPods, recentPods } from "@/lib/pods-db";
import { clubDay, roundComplete, type PodRow } from "@/lib/pods";
import { StoreStyles } from "../../store-styles";
import { AdminNav } from "../admin-nav";
import { KickButton } from "./kick-button";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 14;

const at = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Chicago", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : "-";

const names = (pod: PodRow) => pod.seats.map((s) => s.displayName).join(", ");

export default async function PodsPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const days = Array.from({ length: LOOKBACK_DAYS }, (_, i) =>
    clubDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const [{ filling, playing }, history] = await Promise.all([openPods(), recentPods(days)]);
  const distinctPlayers = new Set(history.flatMap((p) => p.seats.map((s) => s.playerId))).size;
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin/pods" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Open tables</h1>
          {filling.length === 0 && playing.length === 0 && (
            <p className="mt-4 font-extrabold">No tables open right now.</p>
          )}
          <ul className="mt-4 space-y-5">
            {filling.map((pod) => (
              <li key={pod.podId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4">
                <p className="font-extrabold">
                  Filling: {pod.seats.length} seated, opened {at(pod.createdAt)}
                </p>
                <ul className="mt-2 space-y-1">
                  {pod.seats.map((s) => (
                    <li key={s.playerId} className="flex items-center gap-3 text-sm font-extrabold">
                      <span>{s.displayName}</span>
                      <span className="text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                        joined {at(s.joinedAt)}, seen {at(s.lastSeenAt ?? s.joinedAt)}
                      </span>
                      <KickButton podId={pod.podId} playerId={s.playerId} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {playing.map((pod) => (
              <li key={pod.podId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4">
                <p className="font-extrabold">Playing: round {pod.rounds.length}</p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {names(pod)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="tilt-r taped paper mt-8 p-8">
          <h2 className="display text-3xl">Last {LOOKBACK_DAYS} days</h2>
          <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
            {history.length} pods, {distinctPlayers} distinct players.
          </p>
          <ul className="mt-4 space-y-4">
            {history.map((pod) => (
              <li key={pod.podId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-3">
                <p className="font-extrabold">
                  {pod.day}: {pod.status}, {pod.seats.length} players,{" "}
                  {pod.rounds.filter(roundComplete).length} of {pod.rounds.length} rounds reported
                </p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {names(pod) || "nobody seated"}. Opened {at(pod.createdAt)}, closed {at(pod.closedAt)}.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
