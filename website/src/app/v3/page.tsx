import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { FIXTURE, ROSTER, SEASON, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

/*
  DIRECTION — Category Canon (Persuade)
  THESIS: The modern esports org site, played straight. This is the arrangement
    the category always ships, chosen deliberately rather than refused: it is
    the most legible signal that a competitive org is real and organised.
    Executed at the craft level of an established org site, no irony.
  OWN-WORLD: Near-black Recess ground with raised Deep Space panels, Blue Milk
    as the single neon accent carrying glow, edges and active state, Naboo held
    back for the live tag and the primary key. Angular clip-path corners,
    diagonal section cuts, uppercase display at tight tracking, watermark
    numerals, hover lift with accent edge.
  STORY: A visitor hits a hero that says what this is, sees the next match strip
    immediately, meets the roster, reads the standings, sees the content and the
    real community numbers, and joins the Discord.
  FIRST VIEWPORT: Full-bleed dark hero with a Blue Milk radial bloom, ONLINE
    LOCAL in oversized uppercase at left, clipped crew media panel at right, the
    live fixture chip above the headline, primary key bottom-left.
  FORM: category canon (standing exit, user-chosen over the roll); org-site
    staging; bar set at a modern established org site.

  NOTE: this variant deliberately uses devices the craft floor lists as
  category defaults (accent glow, clipped cards, a stat row, uniform roster
  cards). The brief asked for the category default explicitly, which is exactly
  the condition under which those are earned rather than reached for.
*/

export default async function Home() {
  const videos = await getLatestVideos(5);
  return (
    <div className="arena min-h-screen">
      <ArenaStyles />
      <SiteNav />
      <main>
        <Hero />
        <MatchStrip />
        <Roster />
        <Standings />
        <Content videos={videos} />
        <Community />
        <Partners />
      </main>
      <SiteFooter />
    </div>
  );
}

/* Scoped to this route so `/` and `/v2` keep their worlds. Brand hues are fixed
   (PRODUCT.md); this maps them onto the category's own roles: Recess is the
   near-black ground, Blue Milk is the neon, Naboo is the live/primary state. */
function ArenaStyles() {
  return (
    <style>{`
      body { background: #00021c; }
      .arena {
        --ground: #00021c;
        --panel: #000342;
        --raised: #0a1352;
        --neon: #3bb0ff;
        --hot: #ffe81f;
        --text: #eefbff;
        background: var(--ground);
        color: var(--text);
      }
      /* The category's angular cut: a clipped corner on panels and keys. */
      .cut { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%); }
      .cut-sm { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%); }
      .cut-key { clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
      /* Neon edge and bloom. Offset shadow carries the depth; the accent ring
         sits on top of it rather than replacing it. */
      .glow { box-shadow: 0 18px 40px -22px rgba(0,0,0,0.9), 0 0 0 1px color-mix(in srgb, var(--neon) 28%, transparent); }
      .glow-hot { box-shadow: 0 0 24px -4px color-mix(in srgb, var(--hot) 55%, transparent); }
      .display {
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: -0.035em;
        line-height: 0.86;
      }
      .eyebrow {
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        font-size: 0.6875rem;
        color: var(--neon);
      }
      .nums { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
      /* Watermark numeral behind each roster card. */
      .watermark {
        font-weight: 800;
        color: transparent;
        -webkit-text-stroke: 1px color-mix(in srgb, var(--neon) 22%, transparent);
      }
      /* Diagonal section cut, the category's transition between bands. */
      .slash { clip-path: polygon(0 0, 100% 3.5rem, 100% 100%, 0 100%); }
      /* The one authored moment: the hero lifts in as one staggered group.
         Starts visible so no-JS and reduced-motion get the full composition. */
      .lift { animation: lift 0.8s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      @keyframes lift { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
      .live-dot { position: relative; }
      .live-dot::after {
        content: ""; position: absolute; inset: -5px; border-radius: 9999px;
        border: 1px solid var(--hot); animation: ring 2s ease-out infinite;
      }
      @keyframes ring { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(1.5); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) {
        .lift { animation: none; }
        .live-dot::after { animation: none; }
      }
      .arena :focus-visible { outline: 2px solid var(--hot); outline-offset: 3px; }
    `}</style>
  );
}

function SiteNav() {
  const nav = [
    { label: "Roster", href: "#roster" },
    { label: "Standings", href: "#standings" },
    { label: "Content", href: "#content" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] bg-[color-mix(in_srgb,var(--ground)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        <Image
          src="/brand/logo-horizontal.png"
          alt="Blue Milk Gaming"
          width={1200}
          height={453}
          className="h-8 w-auto"
          priority
        />
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="eyebrow !text-[var(--text)] transition-colors hover:!text-[var(--neon)]"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cut-key eyebrow glow-hot bg-[var(--hot)] px-5 py-2.5 !text-[var(--panel)]"
        >
          Join
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)]">
      {/* Accent bloom and grid: the category's hero ground. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 70% at 18% 40%, color-mix(in srgb, var(--neon) 22%, transparent), transparent 70%), radial-gradient(40% 60% at 85% 20%, color-mix(in srgb, var(--neon) 12%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, color-mix(in srgb, var(--neon) 9%, transparent) 0 1px, transparent 1px 64px), repeating-linear-gradient(to bottom, color-mix(in srgb, var(--neon) 9%, transparent) 0 1px, transparent 1px 64px)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="lift flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--hot)]" />
            <span className="eyebrow !text-[var(--hot)]">Live this Sunday</span>
            <span className="eyebrow opacity-60">Season 01</span>
          </div>
          <h1
            className="display lift mt-6 text-[clamp(3rem,10vw,6rem)]"
            style={{ animationDelay: "0.12s" }}
          >
            Online
            <br />
            <span className="text-[var(--neon)]">Local</span>
          </h1>
          <p
            className="lift mt-6 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--text)_78%,transparent)]"
            style={{ animationDelay: "0.19s" }}
          >
            Our weekly Star Wars: Unlimited tournament, every Sunday night. Four
            rounds of Swiss, one table that runs all season.
          </p>
          <div
            className="lift mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "0.26s" }}
          >
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cut-key glow-hot bg-[var(--hot)] px-8 py-4 text-base font-extrabold uppercase tracking-wide text-[var(--panel)] transition-transform hover:-translate-y-0.5"
            >
              Join the Discord
            </a>
            <a
              href="#content"
              className="cut-key border border-[color-mix(in_srgb,var(--neon)_45%,transparent)] px-8 py-4 text-base font-extrabold uppercase tracking-wide text-[var(--neon)] transition-colors hover:bg-[color-mix(in_srgb,var(--neon)_12%,transparent)]"
            >
              Watch
            </a>
          </div>
        </div>
        {/* Clipped media panel: the category's hero visual slot. */}
        <div className="lift cut glow relative" style={{ animationDelay: "0.33s" }}>
          <Image
            src="/brand/crew.jpg"
            alt="Blue Milk Gaming at a Star Wars: Unlimited event"
            width={1600}
            height={1067}
            className="h-72 w-full object-cover object-[50%_28%] sm:h-96"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[var(--ground)] via-transparent to-transparent"
          />
          <div className="absolute bottom-4 left-4">
            <div className="eyebrow">The squad</div>
            <div className="mt-1 font-extrabold uppercase tracking-tight">2026 kit</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* The next-match strip every org site runs under the hero. */
function MatchStrip() {
  return (
    <section className="border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] bg-[var(--panel)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-4 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="live-dot h-2 w-2 rounded-full bg-[var(--hot)]" />
          <span className="eyebrow !text-[var(--hot)]">Next match</span>
        </div>
        <div className="nums flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <span className="text-2xl font-extrabold tracking-tight">
            {FIXTURE.day} {FIXTURE.time}
          </span>
          {[
            ["Competition", FIXTURE.competition],
            ["Format", FIXTURE.format],
            ["Venue", FIXTURE.venue],
          ].map(([k, v]) => (
            <span key={k} className="flex items-baseline gap-2">
              <span className="eyebrow opacity-60">{k}</span>
              <span className="text-sm font-extrabold">{v}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roster() {
  return (
    <section id="roster" className="scroll-mt-16 border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <BandHead eyebrow="The squad" title="Roster" aside="Four members. One table." />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROSTER.map((m) => (
            <article
              key={m.handle}
              className="cut group relative overflow-hidden border border-[color-mix(in_srgb,var(--neon)_20%,transparent)] bg-[var(--raised)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--neon)_60%,transparent)]"
            >
              <span
                aria-hidden="true"
                className="watermark nums pointer-events-none absolute -right-2 -top-6 text-8xl leading-none"
              >
                {m.number}
              </span>
              <div className="eyebrow relative">Player {m.number}</div>
              <h3 className="relative mt-14 text-xl font-extrabold uppercase leading-tight tracking-tight">
                {m.name}
              </h3>
              <p className="nums relative mt-1 text-sm text-[color-mix(in_srgb,var(--text)_60%,transparent)]">
                @{m.handle}
              </p>
              <div
                aria-hidden="true"
                className="relative mt-5 h-0.5 w-10 bg-[var(--neon)] transition-all duration-300 group-hover:w-full"
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Standings() {
  return (
    <section id="standings" className="scroll-mt-16 border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <BandHead
          eyebrow="Season 01"
          title="Standings"
          aside="Points sync from melee.gg once the leaderboard goes live."
        />
        <div className="cut glow mt-12 overflow-hidden border border-[color-mix(in_srgb,var(--neon)_20%,transparent)]">
          <table className="nums w-full text-left">
            <thead>
              <tr className="bg-[var(--panel)]">
                <th scope="col" className="eyebrow w-20 px-5 py-4">#</th>
                <th scope="col" className="eyebrow px-5 py-4">Player</th>
                <th scope="col" className="eyebrow w-28 px-5 py-4 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {SEASON.standings.map((s, i) => (
                <tr
                  key={s.handle}
                  className="border-t border-[color-mix(in_srgb,var(--neon)_14%,transparent)] bg-[var(--raised)] transition-colors hover:bg-[color-mix(in_srgb,var(--neon)_10%,var(--raised))]"
                >
                  <td className="px-5 py-4 text-xl font-extrabold text-[var(--neon)]">{i + 1}</td>
                  <td className="px-5 py-4">
                    <span className="font-extrabold uppercase tracking-tight">{s.name}</span>{" "}
                    <span className="text-sm text-[color-mix(in_srgb,var(--text)_55%,transparent)]">
                      @{s.handle}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-xl font-extrabold">
                    {s.points ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color-mix(in_srgb,var(--text)_60%,transparent)]">
          {SEASON.label} is just kicking off. Standings fill in as we play, and
          top finishers earn points toward the prize wall.
        </p>
      </div>
    </section>
  );
}

function Content({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <section id="content" className="scroll-mt-16 border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <BandHead eyebrow="Latest" title="Content" />
          <a
            href="https://www.youtube.com/@BlueMilkGaming"
            target="_blank"
            rel="noopener noreferrer"
            className="cut-key mt-10 inline-block border border-[color-mix(in_srgb,var(--neon)_45%,transparent)] px-8 py-4 font-extrabold uppercase tracking-wide text-[var(--neon)]"
          >
            Watch on YouTube
          </a>
        </div>
      </section>
    );
  }
  const [feature, ...rest] = videos;
  return (
    <section id="content" className="scroll-mt-16 border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <BandHead
          eyebrow="Latest"
          title="Content"
          aside="New videos weekly, plus weekday lunchtime streams."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Clip video={feature} featured />
          <div className="grid gap-5 sm:grid-cols-2">
            {rest.map((v) => (
              <Clip key={v.id} video={v} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Clip({ video, featured = false }: { video: Video; featured?: boolean }) {
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
      className="cut group flex flex-col border border-[color-mix(in_srgb,var(--neon)_20%,transparent)] bg-[var(--raised)] transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--neon)_60%,transparent)]"
    >
      <div className="relative aspect-video overflow-hidden bg-[var(--panel)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YT thumb, optimizer disabled */}
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Play affordance: the category's standard overlay. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--hot)]">
            <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-[var(--panel)]">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </div>
      <div className={`flex flex-col gap-2 p-4 ${featured ? "sm:p-6" : ""}`}>
        <span className="eyebrow nums">{date}</span>
        <span
          className={`font-extrabold uppercase leading-snug tracking-tight transition-colors group-hover:text-[var(--neon)] ${
            featured ? "text-2xl" : "line-clamp-2 text-base"
          }`}
        >
          {video.title}
        </span>
      </div>
    </a>
  );
}

/* Real numbers only — these come from PRODUCT.md's evidence, not invented. */
function Community() {
  const stats = [
    ["686", "YouTube subscribers"],
    ["554", "Discord members"],
    ["35", "Patreon supporters"],
  ];
  return (
    /* --raised, not --panel: the diagonal is the point of this band, and
       against the near-black ground --panel is too close to read as a cut. */
    <section className="slash relative border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] bg-[var(--raised)] pb-20 pt-24 sm:pb-24 sm:pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-3">
          {stats.map(([n, label]) => (
            <div key={label}>
              <div className="nums display text-5xl text-[var(--neon)] sm:text-6xl">{n}</div>
              <div className="eyebrow mt-3 !text-[var(--text)] opacity-70">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Partners() {
  return (
    <section className="border-b border-[color-mix(in_srgb,var(--neon)_18%,transparent)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <BandHead eyebrow="Partners" title="Backed by" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PARTNERS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cut flex h-32 items-center justify-center border border-[color-mix(in_srgb,var(--neon)_20%,transparent)] bg-[var(--raised)] px-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--neon)_60%,transparent)]"
            >
              <Image
                src={p.logo}
                alt={p.name}
                width={p.width}
                height={p.height}
                className="h-14 w-auto sm:h-16"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function BandHead({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="display mt-3 text-4xl sm:text-5xl">{title}</h2>
      </div>
      {aside && (
        <p className="max-w-xs text-sm leading-relaxed text-[color-mix(in_srgb,var(--text)_60%,transparent)]">
          {aside}
        </p>
      )}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="cut glow flex flex-col items-start justify-between gap-8 border border-[color-mix(in_srgb,var(--neon)_25%,transparent)] bg-[var(--raised)] p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="display text-3xl sm:text-4xl">Pull up a seat</h2>
            <p className="mt-3 max-w-sm leading-relaxed text-[color-mix(in_srgb,var(--text)_70%,transparent)]">
              The whole community lives in Discord. Say hi, get the melee link,
              play the next Online Local.
            </p>
          </div>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cut-key glow-hot shrink-0 bg-[var(--hot)] px-8 py-4 font-extrabold uppercase tracking-wide text-[var(--panel)] transition-transform hover:-translate-y-0.5"
          >
            Join the Discord
          </a>
        </div>
        <nav className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
          {CHANNELS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="eyebrow !text-[var(--text)] opacity-70 transition-colors hover:!text-[var(--neon)] hover:opacity-100"
            >
              {c.label}
            </a>
          ))}
        </nav>
        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-[color-mix(in_srgb,var(--text)_55%,transparent)]">
          Blue Milk Gaming is a fan-run Star Wars: Unlimited community, formed
          2025. Star Wars: Unlimited is © its respective owners.
        </p>
      </div>
    </footer>
  );
}
