import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/db";
import { SEASONS, CURRENT_SEASON, getSeason } from "@/lib/seasons";
import { DISCORD_URL } from "@/data/season";
import { StoreStyles } from "../store-styles";

/*
  The whole whiteboard (The Local world, DESIGN.md). The home page's Board
  shows the top 10; this is the full season list plus past seasons and
  all-time, reached from the Board the same way the prize wall reaches
  /prizes.
*/

export const metadata: Metadata = {
  title: "Standings — Blue Milk Gaming",
  description:
    "Full season standings for the weekly Online Local, our Sunday night Star Wars: Unlimited tournament.",
};

const ALL_TIME = "all-time";

// Intl handles the 11th/12th/13th ordinal edge cases.
const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });
const ORDINAL_SUFFIX: Record<string, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
};
function ordinal(rank: number): string {
  return `${rank}${ORDINAL_SUFFIX[ordinalRules.select(rank)]}`;
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string | string[] }>;
}) {
  const params = await searchParams;
  const seasonId =
    typeof params.season === "string" ? params.season : CURRENT_SEASON.id;
  const season = getSeason(seasonId);
  if (seasonId !== ALL_TIME && !season) notFound();

  const standings = await getLeaderboard(seasonId);

  const tabs = [
    ...SEASONS.map((s) => ({ id: s.id, label: s.name })),
    { id: ALL_TIME, label: "All-time" },
  ];

  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Blue Milk Gaming"
            width={1200}
            height={453}
            className="h-11 w-auto"
            priority
          />
        </Link>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[var(--hot)] px-5 py-2.5 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2"
        >
          Discord
        </a>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <span className="tape">
          {season ? `${season.name} · ${season.set}` : "Every season combined"}
        </span>
        <h1 className="display mt-6 text-[clamp(2.75rem,7vw,5rem)]">
          The whole
          <br />
          board.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_75%,transparent)]">
          Every point from every Sunday. Top finishes at the Online Local earn
          points toward the prize wall, and the board runs all season.
        </p>
        {/* Season swatches pinned in a row: the open season sits lifted and
            straight, the others lie flat on the wall until hovered. */}
        <nav aria-label="Season" className="mt-10 flex flex-wrap gap-3">
          {tabs.map((tab, i) => (
            <Link
              key={tab.id}
              href={
                tab.id === CURRENT_SEASON.id
                  ? "/standings"
                  : `/standings?season=${tab.id}`
              }
              aria-current={tab.id === seasonId ? "page" : undefined}
              className={
                tab.id === seasonId
                  ? "paper px-4 py-2 text-sm font-extrabold uppercase tracking-wide"
                  : `${i % 2 ? "tilt-r" : "tilt-l"} bg-[color-mix(in_srgb,var(--paper)_75%,var(--wall))] px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-[var(--ink)] transition-transform hover:-translate-y-0.5 hover:rotate-0`
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="tilt-s mt-8 rounded-md border border-[color-mix(in_srgb,var(--paper)_35%,transparent)] bg-[var(--board)] p-6 text-[var(--ink)] shadow-[0_18px_40px_-18px_rgba(0,2,28,0.9)] sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-3xl sm:text-4xl">Standings</h2>
            <p className="text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
              {standings.length > 0
                ? season
                  ? `${standings.length} playing this season`
                  : `${standings.length} players across every season`
                : "wiped clean for the new season"}
            </p>
          </div>
          {standings.length > 0 ? (
            <table className="nums mt-6 w-full text-left">
              <thead>
                {/* Nights hides below sm: five columns overflow a phone, and
                    long unbroken usernames need room to wrap. */}
                <tr className="border-b-[3px] border-[var(--ink)]">
                  <th scope="col" className="w-8 py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] sm:w-14">#</th>
                  <th scope="col" className="py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Player</th>
                  <th scope="col" className="hidden w-24 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] sm:table-cell">Nights</th>
                  <th scope="col" className="w-14 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] sm:w-20">Best</th>
                  <th scope="col" className="w-14 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] sm:w-20">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((player: LeaderboardEntry, i: number) => (
                  <tr
                    key={player.meleeUserIdentity}
                    className="border-b-2 border-[color-mix(in_srgb,var(--ink)_12%,transparent)]"
                  >
                    <td className="py-3.5 text-lg font-extrabold text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
                      {i + 1}
                    </td>
                    <td className="py-3.5 pr-2 font-extrabold [overflow-wrap:anywhere]">{player.displayName}</td>
                    <td className="hidden py-3.5 text-right text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)] sm:table-cell">
                      {player.tournamentsPlayed}
                    </td>
                    <td className="py-3.5 text-right text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
                      {ordinal(player.bestFinish)}
                    </td>
                    <td className="py-3.5 text-right text-lg font-extrabold">{player.rankingPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-6 text-lg font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
              No results yet this season. First points go up after Sunday.
            </p>
          )}
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
            href="/prizes"
            className="font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          >
            See the prize wall →
          </Link>
        </div>
      </main>
      <footer className="border-t border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--wall-deep)]">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <p className="max-w-2xl text-xs leading-relaxed text-[color-mix(in_srgb,var(--paper)_55%,transparent)]">
            Blue Milk Gaming is a fan-run Star Wars: Unlimited community, formed
            2025. Star Wars: Unlimited is © its respective owners.
          </p>
        </div>
      </footer>
    </div>
  );
}
