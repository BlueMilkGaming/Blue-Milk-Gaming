"use client";
// The Tables on the home page. The page itself revalidates hourly, so live
// pod state comes from the same poll endpoint /play uses, at a gentler pace.
import { useEffect, useState } from "react";

type HomeSnapshot = {
  lobby: { seats: string[]; createdAt: string } | null;
  playingCount: number;
};

function usePodSnapshot(pollMs: number): HomeSnapshot | null {
  const [snap, setSnap] = useState<HomeSnapshot | null>(null);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/pod", { cache: "no-store" });
        if (live) setSnap(await res.json());
      } catch { /* next tick retries */ }
    };
    tick();
    const timer = setInterval(tick, pollMs);
    return () => { live = false; clearInterval(timer); };
  }, [pollMs]);
  return snap;
}

/**
 * Nav marker for The Tables. While a lobby is open or a pod is running, the
 * Blue Milk dot; otherwise a "NEW" sticker, because pods launched 2026-08-01
 * and nothing like them exists in the community yet. Once the feature is
 * common knowledge (a few weeks post-launch), delete the chip branch and let
 * this go back to being just the dot.
 */
export function TablesNavDot() {
  const snap = usePodSnapshot(60_000);
  if (snap && (snap.lobby || snap.playingCount > 0)) {
    return (
      <span aria-label="tables active" className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-middle" />
    );
  }
  return (
    <span className="ml-1.5 inline-block -rotate-3 bg-[var(--hot)] px-1 py-0.5 align-middle text-[0.5625rem] font-extrabold uppercase leading-none tracking-wide text-[var(--ink)]">
      New
    </span>
  );
}

export function TablesSection() {
  const snap = usePodSnapshot(20_000);
  const seated = snap?.lobby?.seats.length ?? 0;
  return (
    <section id="tables" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">The tables</span>
      <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
        Sit down, play a pod.
      </h2>
      <p className="mt-3 max-w-md text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
        Four to eight chairs, three rounds, points for every win. Open whenever
        enough of us are around.
      </p>
      <div className="tilt-s taped paper mt-10 max-w-xl p-7">
        {snap?.lobby ? (
          <>
            <p className="nums text-xl font-extrabold">A table is filling: {seated} of 8 chairs taken.</p>
            <div className="mt-4 flex gap-2" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className={`h-3 w-6 rounded-sm ${i < seated ? "bg-[var(--accent)]" : "border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)]"}`} />
              ))}
            </div>
          </>
        ) : snap && snap.playingCount > 0 ? (
          <p className="nums text-xl font-extrabold">
            {snap.playingCount} pod{snap.playingCount > 1 ? "s" : ""} in play right now.
          </p>
        ) : (
          <p className="text-lg font-extrabold text-[color-mix(in_srgb,var(--ink)_70%,transparent)]">
            Tables are quiet right now. First pod of the day opens when you sit down.
          </p>
        )}
        <a href="/play" className="mt-5 inline-block bg-[var(--hot)] px-5 py-2.5 font-extrabold uppercase tracking-wide text-[var(--ink)] transition-transform hover:-translate-y-0.5">
          Pull up a chair ↗
        </a>
      </div>
    </section>
  );
}
