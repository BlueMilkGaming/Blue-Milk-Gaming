import type { Metadata } from "next";
import Link from "next/link";
import { PRIZES, DISCORD_URL } from "@/data/season";
import { StoreStyles } from "../store-styles";
import { SiteHeader, SiteFooter } from "../site-chrome";

/*
  Stub for the full prize wall (The Local world, DESIGN.md). Exists so the
  home page's prize tags have a real destination before the redemption page
  is built. Same honesty rules: real tags, no invented costs; the empty
  pegboard is the truthful state, not a placeholder to dress up.
*/

export const metadata: Metadata = {
  title: "The Prize Wall — Blue Milk Gaming",
  description:
    "Points from the weekly Online Local buy things off the prize wall.",
};

export default function PrizeWallPage() {
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <SiteHeader current="/prizes" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <span className="tape">The prize wall</span>
        <h1 className="display mt-6 text-[clamp(2.75rem,7vw,5rem)]">
          The wall is
          <br />
          going up.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_75%,transparent)]">
          Top finishes at the Sunday Online Local earn points, and points buy
          things off this wall. The first tags are hanging; the full list and
          point costs land here soon.
        </p>
        <div className="pegboard mt-12 rounded-xl border-2 border-[color-mix(in_srgb,var(--paper)_40%,transparent)] p-8 shadow-[0_18px_40px_-18px_rgba(0,2,28,0.9)] sm:p-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {PRIZES.map((prize) => (
              <div key={prize.name} className="tilt-r paper p-6 pt-5 text-center">
                <span aria-hidden="true" className="mx-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--wall-deep)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--paper)_45%,var(--wall-deep))]" />
                </span>
                <p className="mt-4 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
                  {prize.kicker}
                </p>
                <p className="mt-2 text-xl font-extrabold leading-tight">{prize.name}</p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {prize.by}
                </p>
              </div>
            ))}
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className={`tilt-s flex min-h-44 flex-col items-center justify-start rounded-sm border-2 border-dashed border-[color-mix(in_srgb,var(--paper)_25%,transparent)] p-6 pt-5 ${
                  i > 1 ? "hidden lg:flex" : ""
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--paper)_45%,var(--wall-deep))]" />
              </div>
            ))}
          </div>
          <p className="tilt-r mt-8 inline-block bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-4 py-2.5 text-sm font-extrabold">
            Every peg gets a tag. Point costs go up with them.
          </p>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-[var(--hot)] px-8 py-4 text-lg font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2"
          >
            Play for points Sunday
          </a>
          <Link
            href="/standings"
            className="font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          >
            Check the standings →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
