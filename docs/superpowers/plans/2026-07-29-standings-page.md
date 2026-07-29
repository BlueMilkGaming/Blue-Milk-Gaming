# Full Standings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-length season standings page at `/standings` with a season switcher (Season 1/2/3/All-time), linked from the home page's Board section.

**Architecture:** One new dynamic server-component route that calls the existing `getLeaderboard(seasonId)`; season selected via `?season=` searchParam. Page chrome copied from `/prizes` (the established "home section → full page" pattern). One link added to the home Board section. No data-layer changes.

**Tech Stack:** Next.js 15 App Router (server components), Tailwind v4 utility classes, existing `src/lib/db.ts` + `src/lib/seasons.ts`.

**Spec:** `docs/superpowers/specs/2026-07-29-standings-page-design.md`

## Global Constraints

- No em dashes in public-facing copy (commas, periods, colons instead). Code comments exempt. The `—` in the metadata title separator matches the existing `/prizes` title pattern and is the only allowed occurrence.
- Never use the bare "BMG" acronym in outward-facing copy; spell out Blue Milk Gaming.
- Never mention Karabast anywhere (copy, comments, commits).
- No new dependencies, no new SST resources, no edge-runtime-only features.
- `next build` and `next dev` share `.next`: **stop any running dev server before building**, and after a build delete `.next` before restarting dev.
- A bare `npm run build` fails with "SST links are not active". Build as: `npx sst shell --stage production -- npm run build` (run in `website/`, needs AWS credentials).
- `git status` currently shows `website/sst-env.d.ts` modified, possibly another session's WIP. Commit only the files each task names; never `git add -A`. Do not deploy as part of this plan.

---

### Task 1: The `/standings` page

**Files:**
- Create: `website/src/app/standings/page.tsx`

**Interfaces:**
- Consumes: `getLeaderboard(seasonId): Promise<LeaderboardEntry[]>` and type `LeaderboardEntry` from `@/lib/db`; `SEASONS`, `CURRENT_SEASON`, `getSeason(id)` from `@/lib/seasons`; `DISCORD_URL` from `@/data/season`; `StoreStyles` from `../store-styles`.
- Produces: the route `/standings` accepting `?season=s1|s2|s3|all-time` (Task 2 links to it bare, Task 3 restyles it).

`LeaderboardEntry` (already defined in `src/lib/db.ts`, do not redefine):

```ts
type LeaderboardEntry = {
  meleeUserIdentity: string;
  displayName: string;
  rankingPoints: number;
  tournamentsPlayed: number;
  bestFinish: number;
};
```

- [ ] **Step 1: Write the page**

Create `website/src/app/standings/page.tsx` with exactly this content:

```tsx
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
        <nav aria-label="Season" className="mt-10 flex flex-wrap gap-3">
          {tabs.map((tab) => (
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
                  : "px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-[color-mix(in_srgb,var(--paper)_70%,transparent)] transition-colors hover:text-[var(--accent)]"
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
                <tr className="border-b-[3px] border-[var(--ink)]">
                  <th scope="col" className="w-14 py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">#</th>
                  <th scope="col" className="py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Player</th>
                  <th scope="col" className="w-24 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Nights</th>
                  <th scope="col" className="w-20 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Best</th>
                  <th scope="col" className="w-20 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Pts</th>
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
                    <td className="py-3.5 font-extrabold">{player.displayName}</td>
                    <td className="py-3.5 text-right text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
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
```

Notes for the implementer:
- `searchParams` is a **Promise** in Next 15; it must be awaited.
- Reading `searchParams` makes this route dynamic (rendered per request). That is intentional per the spec; do not add `generateStaticParams` or `revalidate`.
- The current season's tab links to bare `/standings` so the default view has one canonical URL.
- A repeated param (`?season=s1&season=s2`) arrives as an array, fails the `typeof === "string"` check, and falls back to the current season. Unknown single values 404.

- [ ] **Step 2: Run the existing unit tests (sanity, must stay green)**

Run in `website/`:

```bash
node --test src/lib/*.test.ts
```

Expected: all pass. This task adds no logic to `src/lib`, so any failure is pre-existing; stop and report it rather than fixing unrelated code.

- [ ] **Step 3: Verify with the production build**

Ensure no dev server is running (check for a `next dev` process; kill it if it is yours, ask if it is not). Then in `website/`:

```bash
npx sst shell --stage production -- npm run build > /tmp/standings-build.log 2>&1; echo "exit: $?"
```

Expected: `exit: 0`, and the route list in the log shows `ƒ /standings` (dynamic). Requires AWS credentials; if the build fails with "SST links are not active" the `sst shell` wrapper was dropped. Afterwards delete `website/.next` before anyone restarts the dev server.

- [ ] **Step 4: Verify the rendered page**

Start the dev server (in `website/`, `npm run dev`, needs AWS credentials) and load `http://localhost:3000/standings`. Check:
- Default view shows the current season with the full player list (Season 3 may legitimately be short or empty).
- `?season=s1` and `?season=s2` show full past-season tables (Season 1 had 9 events, expect roughly dozens of rows).
- `?season=all-time` shows the combined board; row count should be near 149 total known players.
- `?season=bogus` returns the 404 page.
- The `Best` column renders ordinals: a rank of 1 shows `1st`, 2 shows `2nd`, 3 shows `3rd`, 11 through 13 show `11th`/`12th`/`13th`, 21 shows `21st`.

- [ ] **Step 5: Commit**

```bash
git add website/src/app/standings/page.tsx
git commit -m "Add full standings page with season switcher"
```

---

### Task 2: Home page link from the Board

**Files:**
- Modify: `website/src/app/page.tsx` (the `Board` function, currently lines 192-247)

**Interfaces:**
- Consumes: the `/standings` route from Task 1.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Add the link**

In `website/src/app/page.tsx`, inside the `Board` function, the section currently ends like this (the note paragraph is the last child of the board `<div>`, which is the last child of the `<section>`):

```tsx
        {/* A note taped to the board's corner. */}
        <p className="tilt-r mt-6 inline-block bg-[color-mix(in_srgb,var(--accent)_18%,var(--board))] px-4 py-2.5 text-sm font-extrabold">
          Points sync from melee.gg every Monday. Top finishers earn points
          toward the prize wall.
        </p>
      </div>
    </section>
```

Add an anchor between the closing `</div>` and `</section>`, mirroring the prize wall section's "See the whole wall ↗" link exactly:

```tsx
        {/* A note taped to the board's corner. */}
        <p className="tilt-r mt-6 inline-block bg-[color-mix(in_srgb,var(--accent)_18%,var(--board))] px-4 py-2.5 text-sm font-extrabold">
          Points sync from melee.gg every Monday. Top finishers earn points
          toward the prize wall.
        </p>
      </div>
      <a
        href="/standings"
        className="paper mt-8 inline-block px-6 py-4 font-extrabold uppercase tracking-wide transition-transform hover:-translate-y-1"
      >
        See the whole board ↗
      </a>
    </section>
```

- [ ] **Step 2: Verify**

With the dev server running, load `http://localhost:3000/`. The Board section shows the "See the whole board ↗" paper button below the whiteboard, styled identically to the prize wall's "See the whole wall ↗" button, and clicking it lands on `/standings`.

- [ ] **Step 3: Commit**

```bash
git add website/src/app/page.tsx
git commit -m "Link the home board to the full standings page"
```

---

### Task 3: Visual pass (main session only)

**Files:**
- Modify: `website/src/app/standings/page.tsx` (styling only)

**Interfaces:**
- Consumes: the working page from Tasks 1-2.
- Produces: the final shipped look.

This task is NOT for a subagent. It runs in the main session because it needs the `impeccable` skill and the browser preview tools.

- [ ] **Step 1: Invoke the `impeccable` skill** on `/standings` with the dev server running. Direction: the page lives in "The Local" store world (see the DIRECTION comment at the top of `website/src/app/page.tsx`); the season tabs and full board should read as physical objects on the store wall, consistent with the home page's whiteboard. Copy rules from Global Constraints apply to any copy changes.
- [ ] **Step 2: Verify in the browser** at desktop and mobile widths (the table has five columns; check it does not overflow at 375px), plus the empty state via the current season if it has no results, or temporarily slicing standings to zero locally.
- [ ] **Step 3: Run the existing tests once more** (`node --test src/lib/*.test.ts`, must stay green) and re-verify `/standings?season=all-time` still renders.
- [ ] **Step 4: Commit**

```bash
git add website/src/app/standings/page.tsx
git commit -m "Polish the standings page for The Local world"
```
