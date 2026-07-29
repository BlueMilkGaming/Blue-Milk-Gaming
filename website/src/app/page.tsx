import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/db";
import { CURRENT_SEASON } from "@/lib/seasons";
import { FIXTURE, ROSTER, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

// Results land once a week via the Monday cron, so hourly is already far
// finer-grained than the data changes.
export const revalidate = 3600;

// The whiteboard shows the leading players, not the whole season. At ~50
// entrants a full table would dwarf every other section on the page.
const BOARD_ROWS = 10;

/*
  DIRECTION — The Local (Persuade)
  THESIS: The Online Local is a game store's weekly night moved online, so the
    site is the store. Refuses the dark-neon esports org page and the borrowed
    sports-club board; the community's own room instead.
  OWN-WORLD: Deep Space navy as the store wall after close. Everything on it is
    a physical artifact: the event flyer in Hoth paper with navy ink, the
    standings whiteboard, name tags for the regulars, videos as stock standing
    on shelf rails, partner stickers on the glass. Translucent Blue Milk tape
    carries every label; Naboo is rationed to "this Sunday" and the primary
    tear-off tab. Slight rotations and offset shadows, no texture packs.
  STORY: A visitor walks up to the store. The flyer says what happens Sunday
    and a tear-off tab is the way in. The regulars, the board, the shelf, then
    the back room: join the Discord.
  FIRST VIEWPORT: The flyer dominates, taped up at a slight tilt: ONLINE LOCAL,
    the fixture block, tear-off DISCORD tabs along the bottom edge with one tab
    already taken. The crew photo hangs pinned beside it.
  FORM: LGS counter (grounded #6, assigned); flyer-on-the-door staging;
    seed 6254c3ee.
*/

// Deliberately not wrapped in a try/catch, unlike getLatestVideos. A missing
// YouTube feed costs a carousel; standings that silently render empty while 48
// people have points is a lie, and a build without resource bindings would
// produce exactly that. Letting this throw fails the build loudly, and at
// revalidation time Next keeps serving the last good page instead.
export default async function Home() {
  const [videos, standings] = await Promise.all([
    getLatestVideos(5),
    getLeaderboard(CURRENT_SEASON.id),
  ]);
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <SiteNav />
      <main>
        <Door />
        <Regulars />
        <Board standings={standings} />
        <Shelf videos={videos} />
        <GlassStickers />
        <BackRoom />
      </main>
      <SiteFooter />
    </div>
  );
}

/* The site's committed world (DESIGN.md). Brand hues are fixed (PRODUCT.md);
   this maps them onto the store's materials: the wall, the paper, the tape,
   the highlighter. */
function StoreStyles() {
  return (
    <style>{`
      body { background: #000342; }
      .store {
        --wall: #000342;
        --wall-deep: #00021c;
        --paper: #eefbff;
        --board: #f8fdff;
        --ink: #000342;
        --accent: #3bb0ff;
        --hot: #ffe81f;
        background:
          radial-gradient(90% 60% at 50% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%),
          var(--wall);
        color: var(--paper);
      }
      /* A pinned artifact: paper lifted off the wall by an offset shadow. */
      .paper {
        background: var(--paper);
        color: var(--ink);
        box-shadow: 0 14px 34px -16px rgba(0, 2, 28, 0.85);
      }
      .tilt-l { transform: rotate(-1deg); }
      .tilt-r { transform: rotate(1.2deg); }
      .tilt-s { transform: rotate(-0.5deg); }
      /* Translucent tape. Label text on tape is always paper-white; navy ink
         fails contrast on a translucent strip over the navy wall. */
      .tape {
        display: inline-block;
        background: color-mix(in srgb, var(--accent) 30%, transparent);
        color: var(--paper);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.6875rem;
        padding: 0.375rem 1.125rem;
        transform: rotate(-0.8deg);
      }
      /* Corner tape pieces holding an artifact to the wall. */
      .taped { position: relative; }
      .taped::before, .taped::after {
        content: "";
        position: absolute;
        width: 5.5rem;
        height: 1.625rem;
        background: color-mix(in srgb, var(--accent) 26%, transparent);
        top: -0.8125rem;
      }
      .taped::before { left: -1.75rem; transform: rotate(-38deg); }
      .taped::after { right: -1.75rem; transform: rotate(38deg); }
      .nums { font-variant-numeric: tabular-nums; }
      .display {
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 0.9;
        text-transform: uppercase;
      }
      /* The one authored moment: the flyer and photo settle onto the wall on
         load, like they were just pinned. Visible by default via backwards
         fill; gated below. */
      .settle { animation: settle 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      @keyframes settle {
        from { opacity: 0; transform: translateY(-14px) rotate(0deg); }
      }
      .settle.tilt-l { animation-name: settle-l; }
      .settle.tilt-r { animation-name: settle-r; }
      @keyframes settle-l {
        from { opacity: 0; transform: translateY(-14px) rotate(0.5deg); }
        to { opacity: 1; transform: translateY(0) rotate(-1deg); }
      }
      @keyframes settle-r {
        from { opacity: 0; transform: translateY(-14px) rotate(-0.5deg); }
        to { opacity: 1; transform: translateY(0) rotate(1.2deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .settle { animation: none; }
      }
      /* Tear-off tabs: dashed cut lines, lift on hover. */
      .tab {
        border-top: 2px dashed color-mix(in srgb, var(--ink) 35%, transparent);
        border-left: 2px dashed color-mix(in srgb, var(--ink) 25%, transparent);
        transition: transform 0.15s ease-out;
      }
      .tab:first-child { border-left: none; }
      .tab:hover { transform: translateY(3px); }
      .store :focus-visible { outline: 2px solid var(--hot); outline-offset: 3px; }
      @media (max-width: 640px) {
        .taped::before { left: -1rem; }
        .taped::after { right: -1rem; }
      }
    `}</style>
  );
}

function SiteNav() {
  const nav = [
    { label: "Regulars", href: "#regulars" },
    { label: "The Board", href: "#board" },
    { label: "The Shelf", href: "#shelf" },
  ];
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Image
        src="/brand/logo-horizontal.png"
        alt="Blue Milk Gaming"
        width={1200}
        height={453}
        className="h-9 w-auto"
        priority
      />
      <nav className="hidden items-center gap-7 md:flex">
        {nav.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          >
            {n.label}
          </a>
        ))}
      </nav>
      {/* The sticker by the register. */}
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-[var(--hot)] px-5 py-2.5 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2"
      >
        Discord
      </a>
    </header>
  );
}

/* The flyer taped up by the door, tear-off tabs and all. */
function Door() {
  const tabs = ["taken", "tab", "tab", "tab", "tab", "tab"] as const;
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pb-32 sm:pt-14">
      <div className="grid items-start gap-14 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
        <div className="settle tilt-l taped paper max-w-xl p-8 sm:p-10" style={{ animationDelay: "0.05s" }}>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--ink)_65%,transparent)]">
            Blue Milk Gaming presents
          </p>
          <h1 className="display mt-4 text-[clamp(3.25rem,8vw,5.5rem)]">
            Online
            <br />
            Local
          </h1>
          <p className="mt-5 max-w-sm leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
            Our weekly Star Wars: Unlimited tournament, every Sunday night. Four
            rounds of Swiss, one table that runs all season.
          </p>
          <dl className="nums mt-7 border-t-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)]">
            {[
              ["When", `${FIXTURE.day}s · ${FIXTURE.time}`],
              ["Format", FIXTURE.format],
              ["Where", FIXTURE.venue],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-baseline justify-between border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2.5"
              >
                <dt className="text-[0.6875rem] font-extrabold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {k}
                </dt>
                <dd className="font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 inline-block bg-[var(--hot)] px-3 py-1 text-sm font-extrabold uppercase tracking-wide">
            This Sunday. All are welcome.
          </p>
          {/* The tear-off strip. One tab is already gone. */}
          <div className="-mx-8 -mb-8 mt-8 flex sm:-mx-10 sm:-mb-10" aria-label="Join the Discord">
            {tabs.map((t, i) =>
              t === "taken" ? (
                <div
                  key={i}
                  aria-hidden="true"
                  className="tab h-16 flex-1 bg-[var(--wall)]"
                  style={{ boxShadow: "inset 0 6px 10px -6px rgba(0,2,28,0.9)" }}
                />
              ) : (
                <a
                  key={i}
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tab flex h-16 flex-1 items-center justify-center"
                >
                  <span className="rotate-90 whitespace-nowrap text-[0.625rem] font-extrabold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ink)_75%,transparent)]">
                    Discord ↗
                  </span>
                </a>
              ),
            )}
          </div>
        </div>
        {/* The crew photo, pinned beside the flyer. */}
        <figure className="settle tilt-r taped paper p-3 pb-4 lg:mt-16" style={{ animationDelay: "0.2s" }}>
          <Image
            src="/brand/crew.jpg"
            alt="Blue Milk Gaming at a Star Wars: Unlimited event"
            width={1600}
            height={1067}
            className="h-64 w-full object-cover object-[50%_28%] sm:h-80"
          />
          <figcaption className="nums mt-3 flex items-baseline justify-between px-1 text-sm font-extrabold text-[var(--ink)]">
            <span>The crew, 2026 kit</span>
            <span className="text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">est. 2025</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* Name tags on the regulars' wall. */
function Regulars() {
  const tilts = ["tilt-s", "tilt-r", "tilt-l", "tilt-s"];
  return (
    <section id="regulars" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">The regulars</span>
      <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
        Same four, every Sunday.
      </h2>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ROSTER.map((m, i) => (
          <div key={m.handle} className={`taped paper ${tilts[i]} p-6`}>
            <p className="nums text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
              Member {m.number}
            </p>
            <p className="mt-3 text-xl font-extrabold leading-tight">{m.name}</p>
            <p className="nums mt-1 text-sm text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
              @{m.handle}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* The whiteboard: season standings in marker. */
function Board({ standings }: { standings: LeaderboardEntry[] }) {
  const leaders = standings.slice(0, BOARD_ROWS);
  return (
    <section id="board" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">{CURRENT_SEASON.name}</span>
      <div className="tilt-s mt-8 rounded-md border border-[color-mix(in_srgb,var(--paper)_35%,transparent)] bg-[var(--board)] p-6 text-[var(--ink)] shadow-[0_18px_40px_-18px_rgba(0,2,28,0.9)] sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display text-3xl sm:text-4xl">Standings</h2>
          <p className="text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
            {standings.length > 0
              ? `top ${leaders.length} of ${standings.length} playing this season`
              : "wiped clean for the new season"}
          </p>
        </div>
        {leaders.length > 0 ? (
          <table className="nums mt-6 w-full text-left">
            <thead>
              <tr className="border-b-[3px] border-[var(--ink)]">
                <th scope="col" className="w-14 py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">#</th>
                <th scope="col" className="py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Player</th>
                <th scope="col" className="w-24 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Nights</th>
                <th scope="col" className="w-20 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Pts</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((player, i) => (
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
        {/* A note taped to the board's corner. */}
        <p className="tilt-r mt-6 inline-block bg-[color-mix(in_srgb,var(--accent)_18%,var(--board))] px-4 py-2.5 text-sm font-extrabold">
          Points sync from melee.gg every Monday. Top finishers earn points
          toward the prize wall.
        </p>
      </div>
    </section>
  );
}

/* This week's videos as stock standing on shelf rails. */
function Shelf({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <section id="shelf" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
        <span className="tape">Fresh stock</span>
        <a
          href="https://www.youtube.com/@BlueMilkGaming"
          target="_blank"
          rel="noopener noreferrer"
          className="paper mt-8 inline-block px-6 py-4 font-extrabold uppercase tracking-wide"
        >
          Watch on YouTube ↗
        </a>
      </section>
    );
  }
  const [feature, ...rest] = videos;
  const topRow = rest.slice(0, 1);
  const bottomRow = rest.slice(1);
  return (
    <section id="shelf" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">Fresh stock</span>
      <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
        New on the shelf.
      </h2>
      <p className="mt-3 max-w-md text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
        New videos weekly, plus weekday lunchtime streams.
      </p>
      {/* Each row of boxes stands on its own rail. */}
      <div className="mt-12 grid items-end gap-x-6 gap-y-0 border-b-4 border-[color-mix(in_srgb,var(--paper)_30%,transparent)] pb-0 lg:grid-cols-[2fr_1fr]">
        <BoxCard video={feature} featured />
        {topRow.map((v) => (
          <BoxCard key={v.id} video={v} />
        ))}
      </div>
      <div className="grid items-end gap-x-6 gap-y-0 border-b-4 border-[color-mix(in_srgb,var(--paper)_30%,transparent)] pb-0 sm:grid-cols-3">
        {bottomRow.map((v) => (
          <BoxCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}

function BoxCard({ video, featured = false }: { video: Video; featured?: boolean }) {
  const date = new Date(video.published).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-10 block transition-transform hover:-translate-y-1.5"
    >
      <div className="paper p-2 pb-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YT thumb, optimizer disabled */}
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className={`w-full object-cover ${featured ? "aspect-video" : "aspect-video"}`}
        />
        {/* The shelf talker under the box. */}
        <div className="nums flex items-baseline gap-3 px-2 py-3 text-[var(--ink)]">
          <span className="shrink-0 bg-[color-mix(in_srgb,var(--accent)_22%,var(--paper))] px-1.5 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-wide">
            {date}
          </span>
          <span
            className={`min-w-0 font-extrabold leading-snug transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))] ${
              featured ? "text-lg" : "line-clamp-1 text-sm"
            }`}
          >
            {video.title}
          </span>
        </div>
      </div>
    </a>
  );
}

/* Partner stickers on the glass door. */
function GlassStickers() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">On the door</span>
      <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Backed by</h2>
      <div className="mt-10 flex flex-wrap gap-6">
        {PARTNERS.map((p, i) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${i % 2 ? "tilt-r" : "tilt-s"} flex h-28 w-full items-center justify-center rounded-xl border-2 border-[color-mix(in_srgb,var(--paper)_40%,transparent)] bg-[var(--wall-deep)] px-10 shadow-[0_14px_30px_-16px_rgba(0,2,28,0.9)] transition-transform hover:rotate-0 sm:w-auto sm:min-w-72`}
          >
            <Image
              src={p.logo}
              alt={p.name}
              width={p.width}
              height={p.height}
              className="h-12 w-auto sm:h-14"
            />
          </a>
        ))}
      </div>
    </section>
  );
}

/* The back room: the real community, the real numbers, the way in. */
function BackRoom() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <span className="tape">The back room</span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            The store&apos;s always open.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_75%,transparent)]">
            The whole community lives in Discord. Say hi, get the melee link,
            play the next Online Local.
          </p>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full bg-[var(--hot)] px-8 py-4 text-lg font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2"
          >
            Join the Discord
          </a>
        </div>
        {/* The community count, on an index card. Real numbers (PRODUCT.md). */}
        <div className="tilt-r taped paper nums max-w-sm p-7">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
            Head count
          </p>
          <ul className="mt-4 space-y-3">
            {[
              ["554", "in the Discord"],
              ["686", "subscribed on YouTube"],
              ["35", "backing on Patreon"],
            ].map(([n, label]) => (
              <li key={label} className="flex items-baseline gap-3 border-b-2 border-[color-mix(in_srgb,var(--ink)_12%,transparent)] pb-3">
                <span className="text-2xl font-extrabold">{n}</span>
                <span className="text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_65%,transparent)]">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--wall-deep)]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-[color-mix(in_srgb,var(--paper)_70%,transparent)] transition-colors hover:text-[var(--accent)]"
            >
              {c.label}
            </a>
          ))}
        </nav>
        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-[color-mix(in_srgb,var(--paper)_55%,transparent)]">
          Blue Milk Gaming is a fan-run Star Wars: Unlimited community, formed
          2025. Star Wars: Unlimited is © its respective owners.
        </p>
      </div>
    </footer>
  );
}
