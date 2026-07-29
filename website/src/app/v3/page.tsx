import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { FIXTURE, ROSTER, SEASON, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

/*
  EXPRESSION — The Local: The Counter (Persuade)
  Same world as / (DESIGN.md: The Local). Variation axis: DENSITY + STRUCTURAL
  DECOMPOSITION. Inside the store, at the register: the fixture prints as a
  receipt, the CTA is a regular's punch card, standings hang on a clipboard,
  the regulars are plaques behind the counter, stock is packed on tighter
  rails. More artifacts, smaller, clustered closer; the hand-placed tilt
  grammar stays. The world's materials are unchanged; the room is just nearer.
*/

export default async function Home() {
  const videos = await getLatestVideos(5);
  return (
    <div className="counter min-h-screen">
      <CounterStyles />
      <SiteNav />
      <main>
        <Register />
        <PlaqueWall />
        <Clipboard />
        <StockBin videos={videos} />
        <ByTheDoor />
      </main>
      <SiteFooter />
    </div>
  );
}

/* Scoped to this route while expressions of The Local are compared. Same
   material tokens as /; the register scene just sits closer to the wall. */
function CounterStyles() {
  return (
    <style>{`
      body { background: #000342; }
      .counter {
        --wall: #000342;
        --wall-deep: #00021c;
        --paper: #eefbff;
        --board: #f8fdff;
        --ink: #000342;
        --accent: #3bb0ff;
        --hot: #ffe81f;
        background:
          radial-gradient(70% 50% at 50% 0%, color-mix(in srgb, var(--accent) 8%, transparent), transparent 70%),
          var(--wall);
        color: var(--paper);
      }
      .paper {
        background: var(--paper);
        color: var(--ink);
        box-shadow: 0 14px 34px -16px rgba(0, 2, 28, 0.85);
      }
      .tilt-l { transform: rotate(-1deg); }
      .tilt-r { transform: rotate(1.2deg); }
      .tilt-s { transform: rotate(-0.5deg); }
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
      /* The receipt's serrated tear edge. */
      .receipt {
        clip-path: polygon(
          0 0, 100% 0, 100% calc(100% - 8px),
          92% 100%, 84% calc(100% - 8px), 76% 100%, 68% calc(100% - 8px),
          60% 100%, 52% calc(100% - 8px), 44% 100%, 36% calc(100% - 8px),
          28% 100%, 20% calc(100% - 8px), 12% 100%, 4% calc(100% - 8px), 0 100%
        );
      }
      /* The one authored moment: the receipt prints out of the slot on load. */
      .print-slot { overflow: hidden; }
      .print { animation: print 0.9s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      @keyframes print {
        from { transform: translateY(-55%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .print { animation: none; }
      }
      /* A punched hole in the regular's card: the wall showing through. */
      .punch {
        width: 1.375rem;
        height: 1.375rem;
        border-radius: 9999px;
        border: 2px solid color-mix(in srgb, var(--ink) 45%, transparent);
      }
      .punch-done { background: var(--wall); border-color: var(--wall); }
      .counter :focus-visible { outline: 2px solid var(--hot); outline-offset: 3px; }
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
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
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

/* The register: headline on the wall, receipt printing, punch card waiting. */
function Register() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-14">
      <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="tape">At the register</span>
          <h1 className="display mt-6 text-[clamp(3.25rem,8vw,5.5rem)]">
            Online
            <br />
            Local
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_78%,transparent)]">
            Our weekly Star Wars: Unlimited tournament, every Sunday night. Four
            rounds of Swiss, one table that runs all season.
          </p>
          {/* The regular's card: the way in, stamped weekly. */}
          <div className="tilt-s taped paper mt-12 max-w-sm p-6">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
              Regular&apos;s card
            </p>
            <p className="mt-2 text-lg font-extrabold leading-snug">
              One stamp every Sunday you play.
            </p>
            <div className="mt-4 flex items-center gap-2.5" aria-hidden="true">
              <span className="punch punch-done" />
              <span className="punch" />
              <span className="punch" />
              <span className="punch" />
              <span className="punch" />
              <span className="punch" />
            </div>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block bg-[var(--hot)] px-4 py-3 text-center font-extrabold uppercase tracking-wide text-[var(--ink)] transition-transform hover:-translate-y-0.5"
            >
              Join the Discord ↗
            </a>
          </div>
        </div>
        {/* The printer slot and its receipt. */}
        <div className="print-slot mx-auto w-full max-w-72 pt-1 lg:mt-4">
          <div className="mx-auto mb-0 h-2.5 w-[85%] rounded-full bg-[var(--wall-deep)] shadow-[inset_0_2px_6px_rgba(0,2,28,0.9)]" />
          <div className="print receipt paper nums mx-auto -mt-0.5 w-[80%] px-5 pb-7 pt-6 text-center">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.24em]">
              The Local
            </p>
            <p className="mt-1 text-[0.625rem] font-extrabold uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
              Blue Milk Gaming · est. 2025
            </p>
            <div className="mt-5 border-t-2 border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)]" />
            <dl className="mt-4 space-y-2.5 text-left text-sm">
              {[
                ["Event", FIXTURE.competition],
                ["Day", `${FIXTURE.day}s`],
                ["Start", FIXTURE.time],
                ["Rounds", FIXTURE.format],
                ["Venue", FIXTURE.venue],
                ["Entry", "Free"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                    {k}
                  </dt>
                  <dd className="font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t-2 border-dashed border-[color-mix(in_srgb,var(--ink)_30%,transparent)]" />
            <p className="mt-4 inline-block bg-[var(--hot)] px-3 py-1 text-sm font-extrabold uppercase tracking-wide">
              See you Sunday
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* The plaques behind the counter. */
function PlaqueWall() {
  const tilts = ["tilt-s", "tilt-r", "tilt-l", "tilt-r"];
  return (
    <section id="regulars" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-16 sm:px-8 sm:py-20">
      <span className="tape">Behind the counter</span>
      <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Same four, every Sunday.
      </h2>
      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_1.6fr]">
        {/* The staff photo, taped up where every store keeps one. */}
        <figure className="tilt-l taped paper p-2.5 pb-3">
          <Image
            src="/brand/crew.jpg"
            alt="Blue Milk Gaming at a Star Wars: Unlimited event"
            width={1600}
            height={1067}
            className="h-48 w-full object-cover object-[50%_28%] sm:h-56"
          />
          <figcaption className="nums mt-2.5 flex items-baseline justify-between px-1 text-sm font-extrabold text-[var(--ink)]">
            <span>The crew, 2026 kit</span>
            <span className="text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">est. 2025</span>
          </figcaption>
        </figure>
        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {ROSTER.map((m, i) => (
            <div key={m.handle} className={`paper ${tilts[i]} p-5`}>
              <p className="nums text-[0.625rem] font-extrabold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
                Member {m.number} · est. 2025
              </p>
              <p className="mt-2.5 text-lg font-extrabold leading-tight">{m.name}</p>
              <p className="nums mt-1 text-sm text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                @{m.handle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Standings on the clipboard that hangs by the register. */
function Clipboard() {
  return (
    <section id="board" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-16 sm:px-8 sm:py-20">
      <span className="tape">Season 01</span>
      <div className="relative mx-auto mt-10 max-w-2xl">
        {/* The clip. */}
        <div className="absolute -top-3.5 left-1/2 z-10 h-7 w-28 -translate-x-1/2 rounded-md bg-[var(--wall-deep)] shadow-[0_6px_14px_-6px_rgba(0,2,28,0.9)]" />
        <div className="tilt-s paper p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-3xl">Standings</h2>
            <p className="text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
              fresh sheet for the new season
            </p>
          </div>
          <table className="nums mt-5 w-full text-left">
            <thead>
              <tr className="border-b-[3px] border-[var(--ink)]">
                <th scope="col" className="w-12 py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">#</th>
                <th scope="col" className="py-2 text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Player</th>
                <th scope="col" className="w-16 py-2 text-right text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]">Pts</th>
              </tr>
            </thead>
            <tbody>
              {SEASON.standings.map((s, i) => (
                <tr key={s.handle} className="border-b-2 border-[color-mix(in_srgb,var(--ink)_12%,transparent)]">
                  <td className="py-3 text-lg font-extrabold text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
                    {i + 1}
                  </td>
                  <td className="py-3">
                    <span className="font-extrabold">{s.name}</span>{" "}
                    <span className="text-sm text-[color-mix(in_srgb,var(--ink)_66%,transparent)]">
                      @{s.handle}
                    </span>
                  </td>
                  <td className="py-3 text-right text-lg font-extrabold">{s.points ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_70%,transparent)]">
            Points sync from melee.gg when the leaderboard goes live. Top
            finishers earn points toward the prize wall.
          </p>
        </div>
      </div>
    </section>
  );
}

/* Stock packed tight on the rails behind the counter. */
function StockBin({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <section id="shelf" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-16 sm:px-8 sm:py-20">
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
  return (
    <section id="shelf" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-16 sm:px-8 sm:py-20">
      <span className="tape">Fresh stock</span>
      <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
        New on the shelf.
      </h2>
      <p className="mt-3 max-w-md text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
        New videos weekly, plus weekday lunchtime streams.
      </p>
      <div className="mt-8 grid grid-cols-2 items-end gap-x-4 border-b-4 border-[color-mix(in_srgb,var(--paper)_30%,transparent)] sm:grid-cols-3 lg:grid-cols-5">
        {videos.map((v) => (
          <a
            key={v.id}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-6 block transition-transform hover:-translate-y-1.5"
          >
            <div className="paper p-1.5 pb-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote YT thumb, optimizer disabled */}
              <img
                src={v.thumbnail}
                alt=""
                loading="lazy"
                className="aspect-video w-full object-cover"
              />
              <div className="nums px-1.5 py-2.5 text-[var(--ink)]">
                <p className="text-[0.625rem] font-extrabold uppercase tracking-wide text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {new Date(v.published).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-extrabold leading-snug transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]">
                  {v.title}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* Partner stickers by the door, the head count, the way in. */
function ByTheDoor() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <span className="tape">The back room</span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            The store&apos;s always open.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_75%,transparent)]">
            The whole community lives in Discord. Say hi, get the melee link,
            play the next Online Local.
          </p>
          <p className="nums mt-6 max-w-md text-sm font-extrabold text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
            554 in the Discord · 686 subscribed on YouTube · 35 backing on
            Patreon
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
        <div className="flex flex-wrap gap-5">
          {PARTNERS.map((p, i) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${i % 2 ? "tilt-r" : "tilt-s"} flex h-24 w-full items-center justify-center rounded-xl border-2 border-[color-mix(in_srgb,var(--paper)_40%,transparent)] bg-[var(--wall-deep)] px-8 shadow-[0_14px_30px_-16px_rgba(0,2,28,0.9)] transition-transform hover:rotate-0 sm:w-auto sm:min-w-60`}
            >
              <Image
                src={p.logo}
                alt={p.name}
                width={p.width}
                height={p.height}
                className="h-11 w-auto"
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
    <footer className="border-t border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[var(--wall-deep)]">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
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
