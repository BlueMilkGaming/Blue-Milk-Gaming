import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { FIXTURE, ROSTER, SEASON, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

/*
  DIRECTION — Sector Chart (Persuade)
  THESIS: The season is a plotted course, not a highlight reel. Blue Milk Gaming
    charts its Online Local the way navigation is charted: graticule, waypoints,
    bearings, a log. Refuses the dark-neon esports page and the broadcast board.
  OWN-WORLD: Printed chart paper as the ground, Deep Space navy as the only ink,
    Blue Milk as tint fields and hairline graticule, Naboo used the way a
    highlighter marks a paper chart: a fill behind the live item with navy read
    over it. Margin ticks, legend blocks, scale bar, compass rose.
  STORY: A visitor lands on the chart of Season 01. The next fixture is the next
    waypoint, already marked. The squad are four plotted fixes. The table is the
    log. They join the Discord to fly the next leg.
  FIRST VIEWPORT: Chart plate edge-to-edge. ONLINE LOCAL set large in navy over
    the graticule with its coordinate block; the course runs through the ringed
    waypoint for this Sunday; the CTA sits under the plot.
  FORM: astrogation / sectional chart (grounded #7, assigned); chart-plate
    staging; seed 75cef19f.
*/

export default async function Home() {
  const videos = await getLatestVideos(5);
  return (
    <div className="chart min-h-screen">
      <ChartStyles />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <MarginRule />
        <ChartHeader />
        <main>
          <Plate />
          <Fixes />
          <Log />
          <Plates videos={videos} />
          <Legend />
        </main>
        <ChartFooter />
      </div>
    </div>
  );
}

/* The chart's own colour system. Scoped to this route so `/` keeps its world.
   Brand hues are fixed (PRODUCT.md); only their roles are reassigned here.
   Paper is a substrate, not a fifth brand colour. */
function ChartStyles() {
  return (
    <style>{`
      body { background: #e6dec9; }
      .chart {
        --paper: #e6dec9;
        --ink: #000342;
        --tint: #3bb0ff;
        --mark: #ffe81f;
        color: var(--ink);
        background: var(--paper);
      }
      /* Graticule: the chart's ruling. Degree lines every 120px, minute ticks
         every 24px. */
      .graticule {
        background-image:
          repeating-linear-gradient(to right, color-mix(in srgb, var(--tint) 34%, transparent) 0 1px, transparent 1px 120px),
          repeating-linear-gradient(to bottom, color-mix(in srgb, var(--tint) 34%, transparent) 0 1px, transparent 1px 120px),
          repeating-linear-gradient(to right, color-mix(in srgb, var(--tint) 16%, transparent) 0 1px, transparent 1px 24px),
          repeating-linear-gradient(to bottom, color-mix(in srgb, var(--tint) 16%, transparent) 0 1px, transparent 1px 24px);
      }
      /* Neat line: the double rule that borders a printed chart plate. */
      .neat {
        border: 1px solid var(--ink);
        box-shadow: 0 0 0 3px var(--paper), 0 0 0 4px color-mix(in srgb, var(--ink) 45%, transparent);
      }
      .ticks {
        background-image: repeating-linear-gradient(to right, var(--ink) 0 1px, transparent 1px 12px);
      }
      .label {
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.6875rem;
      }
      .nums { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
      /* Highlighter: how a paper chart marks the leg in progress. */
      .marked { background: var(--mark); box-shadow: 0 0 0 2px var(--mark); }
      /* The one authored moment: the course draws itself, then the waypoints
         land along it. Default state is fully drawn, so no-JS and
         reduced-motion see the finished plot. */
      .course { animation: plot 1.6s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      @keyframes plot { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
      .wp { animation: fix 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards; transform-box: fill-box; transform-origin: center; }
      @keyframes fix { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
      @media (prefers-reduced-motion: reduce) {
        .course, .wp { animation: none; }
      }
      .chart :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
    `}</style>
  );
}

function MarginRule() {
  return (
    <div className="flex items-center justify-between gap-5 pt-4">
      <span className="label nums opacity-70">BMG SECTIONAL · SEASON 01</span>
      <div className="ticks h-1.5 flex-1 opacity-40" />
      <span className="label nums opacity-70">PLATE 1 OF 1</span>
    </div>
  );
}

function ChartHeader() {
  const nav = [
    { label: "Fixes", href: "#fixes" },
    { label: "Log", href: "#log" },
    { label: "Plates", href: "#plates" },
  ];
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-[var(--ink)] py-5">
      <div className="flex items-center gap-4">
        <Rose className="h-10 w-10 shrink-0" />
        <div className="leading-none">
          <div className="text-lg font-extrabold tracking-tight">Blue Milk Gaming</div>
          <div className="label nums mt-1.5 opacity-70">STAR WARS: UNLIMITED · EST 2025</div>
        </div>
      </div>
      <nav className="flex items-center gap-6">
        {nav.map((n) => (
          <a key={n.href} href={n.href} className="label underline-offset-4 hover:underline">
            {n.label}
          </a>
        ))}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="label marked px-3 py-1.5"
        >
          Discord
        </a>
      </nav>
    </header>
  );
}

/* The hero is a chart plate: graticule field with the season's course plotted
   across it and the next fixture ringed. */
function Plate() {
  return (
    <section className="graticule neat relative my-10 overflow-hidden px-6 py-12 sm:px-10 sm:py-16">
      <CoursePlot />
      <div className="relative max-w-xl">
        <div className="label nums">
          COURSE 01 · {FIXTURE.day.toUpperCase()}S · {FIXTURE.venue.toUpperCase()}
        </div>
        <h1 className="mt-4 text-[clamp(2.75rem,9vw,5.5rem)] font-extrabold leading-[0.88] tracking-[-0.035em]">
          Online
          <br />
          Local
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed">
          A weekly Star Wars: Unlimited tournament, every Sunday night. Four
          rounds of Swiss, one table, plotted across the whole season.
        </p>

        <dl className="nums mt-8 inline-block border border-[var(--ink)] bg-[var(--paper)]">
          <div className="marked flex items-baseline justify-between gap-10 px-4 py-2">
            <dt className="label">NEXT WAYPOINT</dt>
            <dd className="label">THIS SUNDAY</dd>
          </div>
          <div className="border-t border-[var(--ink)] px-4 pt-3">
            <dd className="text-4xl font-extrabold leading-none tracking-tight">
              {FIXTURE.time}
            </dd>
          </div>
          <div className="grid gap-x-10 gap-y-1 px-4 pb-3 pt-3 sm:grid-cols-2">
            {[
              ["FORMAT", FIXTURE.format],
              ["VENUE", FIXTURE.venue],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6">
                <dt className="label opacity-70">{k}</dt>
                <dd className="text-sm font-extrabold">{v}</dd>
              </div>
            ))}
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-extrabold text-[var(--paper)] transition-colors hover:bg-transparent hover:text-[var(--ink)]"
          >
            Join the Discord
          </a>
          <a
            href="#plates"
            className="border border-[var(--ink)] px-6 py-3 font-extrabold transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
          >
            Watch the channel
          </a>
        </div>
      </div>
    </section>
  );
}

/* The plotted course. Chart furniture, not data: the ringed waypoint is the
   fixture named above. Kept to the right of the plate so it never runs under
   the copy or the CTAs.

   The line is SVG with preserveAspectRatio="none" so it stretches with the
   plate; the waypoints are HTML, because a <circle> under that same stretch
   renders as an ellipse. Both are placed off the same percentages, so they
   stay registered at every width. */
/* Deliberately doubles back on itself. A strictly left-to-right zigzag reads
   as a results graph, and we have no results to plot (PRODUCT.md: real data or
   nothing). A route that wanders reads as a route. */
const COURSE = [
  [56, 80],
  [69, 63],
  [62, 43],
  [77, 37],
  [90, 57],
] as const;
const LIVE_WAYPOINT = 3;

function CoursePlot() {
  return (
    /* Hidden below lg: the copy goes full-width there, and the plot's
       percentage positions would land it on top of the paragraph. */
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <polyline
          className="course"
          points={COURSE.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeDasharray="1400"
          opacity="0.45"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {COURSE.map(([x, y], i) => (
        <div
          key={i}
          className="wp absolute"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            animationDelay: `${1.1 + i * 0.09}s`,
          }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            {i === LIVE_WAYPOINT ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-[var(--ink)] bg-[var(--mark)]">
                <div className="h-2 w-2 rounded-full bg-[var(--ink)]" />
              </div>
            ) : (
              <div className="h-2 w-2 rounded-full bg-[var(--ink)]" />
            )}
          </div>
          {i === LIVE_WAYPOINT && (
            <span className="label nums absolute left-5 top-3 whitespace-nowrap opacity-70">
              THIS SUNDAY
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* Compass rose — pure paths, safe inline. */
function Rose({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
      <path d="M24 2 L27.5 20.5 L24 24 L20.5 20.5 Z" fill="currentColor" />
      <path d="M24 46 L20.5 27.5 L24 24 L27.5 27.5 Z" fill="currentColor" opacity="0.35" />
      <path d="M2 24 L20.5 20.5 L24 24 L20.5 27.5 Z" fill="currentColor" opacity="0.35" />
      <path d="M46 24 L27.5 27.5 L24 24 L27.5 20.5 Z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

/* The squad, plotted as four fixes. */
function Fixes() {
  return (
    <section id="fixes" className="scroll-mt-6 border-t border-[var(--ink)] py-16 sm:py-20">
      <PlateHead index="A" title="The fixes" aside="Four members, one call sign each." />
      <div className="mt-10 grid gap-px border border-[var(--ink)] bg-[var(--ink)] sm:grid-cols-2 lg:grid-cols-4">
        {ROSTER.map((m) => (
          <article key={m.handle} className="bg-[var(--paper)] p-5">
            <div className="label nums flex items-center justify-between">
              <span>FIX {m.number}</span>
              <Rose className="h-4 w-4 opacity-40" />
            </div>
            <h3 className="mt-8 text-xl font-extrabold leading-tight tracking-tight">
              {m.name}
            </h3>
            <p className="nums mt-1 text-sm opacity-70">@{m.handle}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 border border-[var(--ink)]">
        <Image
          src="/brand/crew.jpg"
          alt="Blue Milk Gaming at a Star Wars: Unlimited event"
          width={1600}
          height={1067}
          /* 28% down: in a strip this wide the source is scaled tall, so a
             centre crop lands on torsos and object-top lands on the ceiling.
             This holds the faces. */
          className="h-64 w-full object-cover object-[50%_28%] sm:h-80"
        />
      </div>
    </section>
  );
}

/* Standings as the chart's log: ruled, tabular, no invented numbers. */
function Log() {
  return (
    <section id="log" className="scroll-mt-6 border-t border-[var(--ink)] py-16 sm:py-20">
      <PlateHead
        index="B"
        title="The log"
        aside="Points sync from melee.gg once the leaderboard goes live."
      />
      <table className="nums mt-10 w-full border border-[var(--ink)] text-left">
        <thead>
          <tr className="border-b border-[var(--ink)]">
            <th scope="col" className="label w-16 px-4 py-3">POS</th>
            <th scope="col" className="label px-4 py-3">PLAYER</th>
            <th scope="col" className="label w-24 px-4 py-3 text-right">PTS</th>
          </tr>
        </thead>
        <tbody>
          {SEASON.standings.map((s, i) => (
            <tr key={s.handle} className="border-b border-[var(--ink)]/25 last:border-0">
              <td className="px-4 py-3 text-lg font-extrabold">{i + 1}</td>
              <td className="px-4 py-3">
                <span className="font-extrabold">{s.name}</span>{" "}
                <span className="text-sm opacity-60">@{s.handle}</span>
              </td>
              <td className="px-4 py-3 text-right text-lg font-extrabold">
                {s.points ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-70">
        {SEASON.label} is just kicking off. The log fills in as we play, and top
        finishers earn points toward the prize wall.
      </p>
    </section>
  );
}

/* Videos as numbered chart plates. */
function Plates({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <section id="plates" className="scroll-mt-6 border-t border-[var(--ink)] py-16 sm:py-20">
        <PlateHead index="C" title="The plates" />
        <a
          href="https://www.youtube.com/@BlueMilkGaming"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block border border-[var(--ink)] px-6 py-3 font-extrabold transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          Watch on YouTube
        </a>
      </section>
    );
  }
  return (
    <section id="plates" className="scroll-mt-6 border-t border-[var(--ink)] py-16 sm:py-20">
      <PlateHead
        index="C"
        title="The plates"
        aside="New videos weekly, plus weekday lunchtime streams."
      />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v, i) => (
          <PlateCard key={v.id} video={v} n={i + 1} />
        ))}
      </div>
    </section>
  );
}

function PlateCard({ video, n }: { video: Video; n: number }) {
  const date = new Date(video.published).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col border border-[var(--ink)] bg-[var(--paper)]"
    >
      <div className="label nums flex items-center justify-between border-b border-[var(--ink)] px-3 py-2">
        <span>PLATE {String(n).padStart(2, "0")}</span>
        <span className="opacity-70">{date}</span>
      </div>
      <div className="aspect-video overflow-hidden border-b border-[var(--ink)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YT thumb, optimizer disabled */}
        <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
      <h3 className="p-3 font-extrabold leading-snug decoration-2 underline-offset-4 group-hover:underline">
        {video.title}
      </h3>
    </a>
  );
}

/* Sponsors sit in the chart legend, where a key belongs. */
function Legend() {
  return (
    <section className="border-t border-[var(--ink)] py-16 sm:py-20">
      <PlateHead index="D" title="The legend" aside="Who backs the season." />
      <div className="mt-10 grid gap-px border border-[var(--ink)] bg-[var(--ink)] sm:grid-cols-2">
        {PARTNERS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-5 bg-[var(--paper)] px-5 py-7"
          >
            <span className="marked label shrink-0 px-2 py-1">KEY</span>
            {/* The marks are white, so on paper they need the navy plate under them. */}
            <span className="flex h-16 flex-1 items-center justify-center bg-[var(--ink)] px-5 transition-opacity group-hover:opacity-80">
              <Image
                src={p.logo}
                alt={p.name}
                width={p.width}
                height={p.height}
                className="h-9 w-auto"
              />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function PlateHead({
  index,
  title,
  aside,
}: {
  index: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-baseline gap-4">
        <span className="label nums border border-[var(--ink)] px-2 py-1">{index}</span>
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {aside && <p className="max-w-xs text-sm leading-relaxed opacity-70">{aside}</p>}
    </div>
  );
}

/* Chart margin close: scale bar, the honest disclaimer, tick strip. */
function ChartFooter() {
  return (
    <footer className="border-t border-[var(--ink)] py-12">
      <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="max-w-sm text-2xl font-extrabold tracking-tight">
            Plot the next leg with us.
          </h2>
          <p className="mt-3 max-w-sm leading-relaxed opacity-70">
            The whole community lives in Discord. Say hi, get the melee link,
            play the next Online Local.
          </p>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block border border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-extrabold text-[var(--paper)] transition-colors hover:bg-transparent hover:text-[var(--ink)]"
          >
            Join the Discord
          </a>
        </div>
        <div className="shrink-0">
          <div className="label nums opacity-70">SEASON SCALE</div>
          <div className="mt-2 flex h-4 w-48 border border-[var(--ink)]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex-1 ${i % 2 === 0 ? "bg-[var(--ink)]" : ""} ${
                  i > 0 ? "border-l border-[var(--ink)]" : ""
                }`}
              />
            ))}
          </div>
          <div className="label nums mt-1 flex w-48 justify-between opacity-70">
            <span>WK 01</span>
            <span>WK 52</span>
          </div>
        </div>
      </div>
      <nav className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--ink)] pt-6">
        {CHANNELS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="label underline-offset-4 hover:underline"
          >
            {c.label}
          </a>
        ))}
      </nav>
      <p className="mt-6 max-w-2xl text-xs leading-relaxed opacity-60">
        Blue Milk Gaming is a fan-run Star Wars: Unlimited community, formed
        2025. Star Wars: Unlimited is © its respective owners.
      </p>
      <div className="ticks mt-6 h-1.5 opacity-40" />
    </footer>
  );
}
