import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { FIXTURE, ROSTER, SEASON, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

/*
  EXPRESSION — The Local: The Window (Persuade)
  Same world as / (DESIGN.md: The Local). Variation axis: HIERARCHY + FORMAL
  ORDER. The store is seen from the sidewalk at night: the lit window carries
  one monumental poster, mounted straight behind glass, not taped at a tilt.
  Sill objects (hours card, crew photo) stand aligned on rails. The only tilted
  things are the stickers on the glass, because stickers are the only thing
  that lives ON glass. The OPEN sign hangs inside the window and is the page's
  Naboo highlight. Casual collage becomes composed display; the world's
  materials are unchanged.
*/

export default async function Home() {
  const videos = await getLatestVideos(5);
  return (
    <div className="street min-h-screen">
      <WindowStyles />
      <SiteNav />
      <main>
        <StoreWindow />
        <SillRegulars />
        <Board />
        <Shelf videos={videos} />
        <BackRoom />
      </main>
      <SiteFooter />
    </div>
  );
}

/* Scoped to this route while expressions of The Local are compared. Same
   material tokens as / with one addition: the street is a step darker than
   the store wall, so the lit window reads as the bright thing. */
function WindowStyles() {
  return (
    <style>{`
      body { background: #00021c; }
      .street {
        --street: #00021c;
        --wall: #000342;
        --paper: #eefbff;
        --board: #f8fdff;
        --ink: #000342;
        --accent: #3bb0ff;
        --hot: #ffe81f;
        background: var(--street);
        color: var(--paper);
      }
      .paper {
        background: var(--paper);
        color: var(--ink);
        box-shadow: 0 14px 34px -16px rgba(0, 2, 28, 0.85);
      }
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
      .nums { font-variant-numeric: tabular-nums; }
      .display {
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 0.9;
        text-transform: uppercase;
      }
      /* The window: the store wall glowing behind glass, framed by mullions. */
      .window {
        background:
          radial-gradient(80% 70% at 50% 20%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 75%),
          var(--wall);
        border: 6px solid color-mix(in srgb, var(--paper) 16%, transparent);
      }
      /* One diagonal streetlight glare across the glass. Glass is a named
         material of this scene, not decoration. */
      .glare { position: relative; overflow: hidden; }
      .glare::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
          115deg,
          transparent 42%,
          rgba(238, 251, 255, 0.05) 47%,
          rgba(238, 251, 255, 0.09) 51%,
          transparent 60%
        );
      }
      /* The one authored moment: the OPEN sign swings once to rest. */
      .sign {
        transform-origin: top center;
        animation: swing 1.1s cubic-bezier(0.16, 1, 0.3, 1) backwards;
        transform: rotate(-1.5deg);
      }
      @keyframes swing {
        from { transform: rotate(5deg); }
        60% { transform: rotate(-3deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .sign { animation: none; }
      }
      /* Stickers live on the glass; the only tilted objects on this page. */
      .sticker-l { transform: rotate(-2deg); }
      .sticker-r { transform: rotate(1.5deg); }
      .street :focus-visible { outline: 2px solid var(--hot); outline-offset: 3px; }
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

/* The lit storefront window: poster centered, sill objects aligned below. */
function StoreWindow() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pb-32">
      <div className="window glare relative px-5 pb-0 pt-12 sm:px-10 sm:pt-16">
        {/* The OPEN sign, hung inside the glass. The page's highlight. On
           phones it hangs centered above the painted name instead of beside
           it; there is no spare glass at that width. */}
        <div className="sign mx-auto -mt-6 w-fit bg-[var(--hot)] px-4 py-3 text-center text-[var(--ink)] shadow-[0_10px_24px_-12px_rgba(0,2,28,0.9)] sm:absolute sm:right-12 sm:top-0 sm:mx-0 sm:mt-0">
          <p className="display text-2xl">Open</p>
          <p className="text-[0.625rem] font-extrabold uppercase tracking-[0.16em]">
            Sundays {FIXTURE.time}
          </p>
        </div>
        {/* Painted on the glass. */}
        <p className="mt-6 text-center text-[0.6875rem] font-extrabold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--paper)_65%,transparent)] sm:mt-0">
          Blue Milk Gaming · est. 2025
        </p>
        {/* The poster, mounted straight. */}
        <div className="paper mx-auto mt-10 max-w-2xl p-8 text-center sm:p-12" style={{ boxShadow: "0 10px 26px -14px rgba(0,2,28,0.9)" }}>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--ink)_65%,transparent)]">
            Weekly · all season
          </p>
          <h1 className="display mt-4 text-[clamp(3.25rem,9vw,6rem)]">
            Online
            <br />
            Local
          </h1>
          <p className="mx-auto mt-5 max-w-sm leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
            Our weekly Star Wars: Unlimited tournament, every Sunday night. Four
            rounds of Swiss, one table that runs all season.
          </p>
          <p className="nums mt-7 border-t-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-5 font-extrabold">
            {FIXTURE.day}s · {FIXTURE.time} · {FIXTURE.format} · {FIXTURE.venue}
          </p>
        </div>
        {/* Stickers on the glass, overlapping the poster's lower edge. */}
        <div className="relative z-10 -mt-7 flex flex-wrap items-center justify-center gap-4">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sticker-l flex h-28 w-28 items-center justify-center rounded-full bg-[var(--hot)] p-3 text-center text-sm font-extrabold uppercase leading-tight text-[var(--ink)] shadow-[0_14px_30px_-14px_rgba(0,2,28,0.95)] transition-transform hover:rotate-0 sm:h-32 sm:w-32"
          >
            Join the Discord ↗
          </a>
        </div>
        {/* The sill: crew photo and hours card standing on the frame's rail. */}
        <div className="mt-10 grid items-end gap-8 border-t-[6px] border-[color-mix(in_srgb,var(--paper)_16%,transparent)] pb-10 pt-10 sm:grid-cols-[1.4fr_1fr] sm:gap-10">
          <figure className="paper p-3 pb-4">
            <Image
              src="/brand/crew.jpg"
              alt="Blue Milk Gaming at a Star Wars: Unlimited event"
              width={1600}
              height={1067}
              className="h-56 w-full object-cover object-[50%_28%] sm:h-72"
            />
            <figcaption className="nums mt-3 flex items-baseline justify-between px-1 text-sm font-extrabold text-[var(--ink)]">
              <span>The crew, 2026 kit</span>
              <span className="text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">est. 2025</span>
            </figcaption>
          </figure>
          <div className="paper nums p-6 sm:p-7">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
              Game night hours
            </p>
            <dl className="mt-4">
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
            <p className="mt-4 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_75%,transparent)]">
              All are welcome. Walk-ins play free.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Name cards standing in a straight row on the sill rail. */
function SillRegulars() {
  return (
    <section id="regulars" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">The regulars</span>
      <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
        Same four, every Sunday.
      </h2>
      <div className="mt-12 grid items-end gap-6 border-b-4 border-[color-mix(in_srgb,var(--paper)_30%,transparent)] pb-0 sm:grid-cols-2 lg:grid-cols-4">
        {ROSTER.map((m) => (
          <div key={m.handle} className="paper mb-0 p-6 pb-7">
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

/* The whiteboard, seen straight-on through the glass. */
function Board() {
  return (
    <section id="board" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">Season 01</span>
      <div className="mt-8 rounded-md border border-[color-mix(in_srgb,var(--paper)_35%,transparent)] bg-[var(--board)] p-6 text-[var(--ink)] shadow-[0_18px_40px_-18px_rgba(0,2,28,0.9)] sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="display text-3xl sm:text-4xl">Standings</h2>
          <p className="text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
            wiped clean for the new season
          </p>
        </div>
        <table className="nums mt-6 w-full text-left">
          <thead>
            <tr className="border-b-[3px] border-[var(--ink)]">
              <th scope="col" className="w-14 py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">#</th>
              <th scope="col" className="py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Player</th>
              <th scope="col" className="w-20 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Pts</th>
            </tr>
          </thead>
          <tbody>
            {SEASON.standings.map((s, i) => (
              <tr key={s.handle} className="border-b-2 border-[color-mix(in_srgb,var(--ink)_12%,transparent)]">
                <td className="py-3.5 text-lg font-extrabold text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
                  {i + 1}
                </td>
                <td className="py-3.5">
                  <span className="font-extrabold">{s.name}</span>{" "}
                  <span className="text-sm text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
                    @{s.handle}
                  </span>
                </td>
                <td className="py-3.5 text-right text-lg font-extrabold">{s.points ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 inline-block bg-[color-mix(in_srgb,var(--accent)_18%,var(--board))] px-4 py-2.5 text-sm font-extrabold">
          Points sync from melee.gg when the leaderboard goes live. Top finishers
          earn points toward the prize wall.
        </p>
      </div>
    </section>
  );
}

/* Fresh stock on straight rails, uniform boxes in the display. */
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
  return (
    <section id="shelf" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
      <span className="tape">Fresh stock</span>
      <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
        New on the shelf.
      </h2>
      <p className="mt-3 max-w-md text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
        New videos weekly, plus weekday lunchtime streams.
      </p>
      <div className="mt-12 grid items-end gap-6 border-b-4 border-[color-mix(in_srgb,var(--paper)_30%,transparent)] pb-0 lg:grid-cols-[2fr_1fr]">
        <BoxCard video={feature} featured />
        {rest.slice(0, 1).map((v) => (
          <BoxCard key={v.id} video={v} />
        ))}
      </div>
      <div className="grid items-end gap-6 border-b-4 border-[color-mix(in_srgb,var(--paper)_30%,transparent)] pb-0 sm:grid-cols-3">
        {rest.slice(1).map((v) => (
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
          className="aspect-video w-full object-cover"
        />
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

/* Partner stickers and the way in. */
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
          {/* The head count, painted small by the door. Real numbers. */}
          <p className="nums mt-8 max-w-md text-sm font-extrabold text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
            554 in the Discord · 686 subscribed on YouTube · 35 backing on
            Patreon
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          {PARTNERS.map((p, i) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${i % 2 ? "sticker-r" : "sticker-l"} flex h-28 w-full items-center justify-center rounded-xl border-2 border-[color-mix(in_srgb,var(--paper)_40%,transparent)] bg-[var(--wall)] px-10 shadow-[0_14px_30px_-16px_rgba(0,2,28,0.9)] transition-transform hover:rotate-0 sm:w-auto sm:min-w-64`}
            >
              <Image
                src={p.logo}
                alt={p.name}
                width={p.width}
                height={p.height}
                className="h-12 w-auto"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--wall)]">
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
