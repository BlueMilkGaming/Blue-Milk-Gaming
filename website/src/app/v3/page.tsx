import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { FIXTURE, ROSTER, SEASON, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

/*
  DIRECTION — Deck Fascia (Persuade)
  THESIS: The org is one piece of hardware. Every function is a labelled control
    on a single brushed-aluminium front panel, the way the analogue future of
    the original trilogy actually looked: engraved, bolted, switched. Refuses
    the dark-neon esports page and the printed-chart plate alike.
  OWN-WORLD: Brushed aluminium fascia over a beige plastic surround, Deep Space
    navy engraved into the metal as every label and legend, Naboo as the LED
    ladder that only lights for live and active state, Blue Milk as the channel
    indicator. Milled tracks, chrome bezels, screw heads, a serial plate.
  STORY: A visitor arrives at a switched-on machine. The transport counter shows
    the next fixture, the channel strips name the squad, the ladder shows the
    season, and the big bezelled key joins the Discord.
  FIRST VIEWPORT: One fascia panel edge to edge. Engraved ONLINE LOCAL at left
    with its function legend; at right the transport readout with the amber
    ladder lit for THIS SUNDAY; the JOIN key sits bottom-left under its legend.
  FORM: cassette-futurist deck fascia (dealt challenger, fused); single-fascia
    staging; seed 75cef19f.
*/

export default async function Home() {
  const videos = await getLatestVideos(5);
  return (
    <div className="deck min-h-screen py-6 sm:py-10">
      <DeckStyles />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="fascia">
          <TopPlate />
          <main>
            <Transport />
            <Channels />
            <Ladder />
            <Tape videos={videos} />
            <MakerPlates />
          </main>
          <RearPanel />
        </div>
      </div>
    </div>
  );
}

/* The machine's materials. Scoped to this route so `/` keeps its world.
   Brand hues are fixed (PRODUCT.md); metal and plastic are substrate, and the
   brand colours do the engraving and the lamps. */
function DeckStyles() {
  return (
    <style>{`
      body { background: #cfc7b6; }
      .deck {
        --metal: #b9bcc0;
        --metal-hi: #dfe2e5;
        --metal-lo: #8d9196;
        --plastic: #cfc7b6;
        --engrave: #000342;
        --lamp: #ffe81f;
        --indicator: #3bb0ff;
        color: var(--engrave);
        background: var(--plastic);
      }
      /* Brushed aluminium: fine vertical grain plus a broad cross-panel
         highlight, so the sheen moves across the panel rather than sitting
         flat. No image asset. */
      .fascia {
        background-image:
          linear-gradient(105deg,
            color-mix(in srgb, var(--metal-hi) 85%, transparent) 0%,
            transparent 22%,
            transparent 58%,
            color-mix(in srgb, var(--metal-hi) 55%, transparent) 76%,
            transparent 92%),
          repeating-linear-gradient(to right,
            color-mix(in srgb, var(--metal-lo) 28%, transparent) 0 1px,
            transparent 1px 3px),
          linear-gradient(to bottom, var(--metal-hi), var(--metal) 12%, var(--metal) 88%, var(--metal-lo));
        border: 1px solid var(--metal-lo);
        border-radius: 6px;
        box-shadow:
          inset 0 1px 0 color-mix(in srgb, #fff 70%, transparent),
          inset 0 -1px 0 color-mix(in srgb, var(--metal-lo) 80%, transparent),
          0 18px 40px -18px rgba(0, 3, 66, 0.55);
        overflow: hidden;
      }
      /* Engraved label: cut into the metal, so it carries a light lower edge. */
      .engraved {
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 0.625rem;
        color: color-mix(in srgb, var(--engrave) 78%, transparent);
        text-shadow: 0 1px 0 color-mix(in srgb, #fff 60%, transparent);
      }
      .nums { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
      /* A milled recess: where a readout or a meter is sunk into the panel. */
      .recessed {
        background: linear-gradient(to bottom, #1a1d33, #0b0d1c);
        border-radius: 3px;
        box-shadow:
          inset 0 2px 5px rgba(0, 0, 0, 0.75),
          0 1px 0 color-mix(in srgb, #fff 65%, transparent);
      }
      /* Panel seam: how two bolted zones meet. */
      .seam { border-top: 1px solid var(--metal-lo); box-shadow: 0 1px 0 color-mix(in srgb, #fff 60%, transparent); }
      /* Chrome bezel around the primary key. */
      .bezel {
        background: linear-gradient(to bottom, var(--metal-hi), var(--metal-lo));
        border-radius: 4px;
        box-shadow: inset 0 1px 0 #fff, 0 2px 4px rgba(0, 3, 66, 0.35);
      }
      /* Lamps. Off is a dark lens in the metal; on is the lens lit from within. */
      .lamp { border-radius: 2px; background: color-mix(in srgb, var(--engrave) 30%, var(--metal-lo)); }
      .lamp-on { background: var(--lamp); box-shadow: 0 0 6px color-mix(in srgb, var(--lamp) 70%, transparent); }
      .lamp-ind { background: var(--indicator); box-shadow: 0 0 6px color-mix(in srgb, var(--indicator) 70%, transparent); }
      /* The one authored moment: at power-on the ladder lights rung by rung,
         the way a real meter sweeps up and settles. Default is lit, so no-JS
         and reduced-motion see the machine already on. */
      .rung { animation: light 0.42s steps(1, end) backwards; }
      @keyframes light { from { opacity: 0.25; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .rung { animation: none; } }
      .deck :focus-visible { outline: 2px solid var(--engrave); outline-offset: 2px; }
    `}</style>
  );
}

/* Screw head — the fascia is bolted on. */
function Screw({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block h-2.5 w-2.5 rounded-full bg-[var(--metal-lo)] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.6)] ${className}`}
    >
      <span className="mx-auto block h-px w-1.5 translate-y-[4px] rotate-45 bg-[color-mix(in_srgb,var(--engrave)_60%,transparent)]" />
    </span>
  );
}

function TopPlate() {
  const nav = [
    { label: "Channels", href: "#channels" },
    { label: "Ladder", href: "#ladder" },
    { label: "Tape", href: "#tape" },
  ];
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-4 sm:px-7">
      <div className="flex items-center gap-4">
        <Screw />
        <div className="leading-none">
          <div className="text-base font-extrabold tracking-tight">Blue Milk Gaming</div>
          <div className="engraved mt-1.5">MODEL BMG-01 · STAR WARS: UNLIMITED</div>
        </div>
      </div>
      <nav className="flex items-center gap-5">
        {nav.map((n) => (
          <a key={n.href} href={n.href} className="engraved hover:text-[var(--engrave)]">
            {n.label}
          </a>
        ))}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bezel engraved px-3 py-2 text-[var(--engrave)]"
        >
          Discord
        </a>
        <Screw />
      </nav>
    </header>
  );
}

/* The hero is the transport section: the counter, the legend, the big key. */
function Transport() {
  return (
    <section className="seam grid gap-10 px-5 py-10 sm:px-7 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div>
        <div className="engraved">FUNCTION · WEEKLY TOURNAMENT</div>
        <h1 className="mt-3 text-[clamp(2.5rem,7.5vw,4.75rem)] font-extrabold leading-[0.9] tracking-[-0.035em]">
          Online
          <br />
          Local
        </h1>
        <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[color-mix(in_srgb,var(--engrave)_85%,transparent)]">
          A weekly Star Wars: Unlimited tournament, every Sunday night. Four
          rounds of Swiss, one table, running all season.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bezel px-7 py-3.5 text-base font-extrabold text-[var(--engrave)] transition-transform active:translate-y-px"
          >
            Join the Discord
          </a>
          <a
            href="#tape"
            className="engraved border border-[var(--metal-lo)] px-5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
          >
            Watch the channel
          </a>
        </div>
      </div>

      {/* The readout, sunk into the panel. */}
      <div className="recessed p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="engraved !text-[color-mix(in_srgb,var(--metal-hi)_70%,transparent)] [text-shadow:none]">
            NEXT TRANSPORT
          </span>
          <span className="flex items-center gap-2">
            <span className="lamp lamp-on h-2 w-2" />
            <span className="engraved !text-[var(--lamp)] [text-shadow:none]">THIS SUNDAY</span>
          </span>
        </div>
        <div className="nums mt-5 text-[clamp(2.25rem,6vw,3.25rem)] font-extrabold leading-none tracking-tight text-[var(--metal-hi)]">
          {FIXTURE.time}
        </div>
        <div className="engraved mt-1 !text-[color-mix(in_srgb,var(--metal-hi)_60%,transparent)] [text-shadow:none]">
          {FIXTURE.day.toUpperCase()}
        </div>
        <dl className="mt-6 space-y-2 border-t border-[color-mix(in_srgb,var(--metal-hi)_18%,transparent)] pt-4">
          {[
            ["COMPETITION", FIXTURE.competition],
            ["FORMAT", FIXTURE.format],
            ["VENUE", FIXTURE.venue],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6">
              <dt className="engraved !text-[color-mix(in_srgb,var(--metal-hi)_55%,transparent)] [text-shadow:none]">
                {k}
              </dt>
              <dd className="nums text-sm font-extrabold text-[var(--metal-hi)]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* The squad as channel strips: each one a labelled control on the panel. */
function Channels() {
  return (
    <section id="channels" className="seam scroll-mt-4 px-5 py-10 sm:px-7 sm:py-14">
      <PanelHead title="The crew" legend="CHANNELS 01–04" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROSTER.map((m) => (
          <article
            key={m.handle}
            className="border border-[var(--metal-lo)] bg-[color-mix(in_srgb,var(--metal-hi)_38%,transparent)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
          >
            <div className="flex items-center justify-between">
              <span className="engraved nums">CH {m.number}</span>
              {/* Unlit lens. Nothing per-member is live, so nothing lights. */}
              <span className="lamp h-2 w-2" />
            </div>
            <h3 className="mt-6 text-lg font-extrabold leading-tight tracking-tight">
              {m.name}
            </h3>
            <p className="nums mt-0.5 text-sm text-[color-mix(in_srgb,var(--engrave)_65%,transparent)]">
              @{m.handle}
            </p>
            {/* Milled fader track under each strip. */}
            <div className="mt-4 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--engrave)_18%,var(--metal-lo))] shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]" />
          </article>
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-sm border border-[var(--metal-lo)]">
        <Image
          src="/brand/crew.jpg"
          alt="Blue Milk Gaming at a Star Wars: Unlimited event"
          width={1600}
          height={1067}
          /* See the note in /v2: a wide strip scales this source tall, so the
             faces sit around 28% rather than at the centre or the top. */
          className="h-60 w-full object-cover object-[50%_28%] sm:h-72"
        />
      </div>
    </section>
  );
}

/* Standings as the meter ladder. No rung is lit, because no points exist yet:
   the machine is powered up and waiting, which is the truth. */
function Ladder() {
  const RUNGS = 12;
  return (
    <section id="ladder" className="seam scroll-mt-4 px-5 py-10 sm:px-7 sm:py-14">
      <PanelHead
        title="The ladder"
        legend="SEASON 01 · LEVELS"
        aside="Points sync from melee.gg once the leaderboard goes live."
      />
      <div className="recessed mt-8 divide-y divide-[color-mix(in_srgb,var(--metal-hi)_12%,transparent)] p-5 sm:p-6">
        {SEASON.standings.map((s, i) => (
          <div
            key={s.handle}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="nums engraved w-6 !text-[color-mix(in_srgb,var(--metal-hi)_55%,transparent)] [text-shadow:none]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-40 flex-1">
              <span className="font-extrabold text-[var(--metal-hi)]">{s.name}</span>{" "}
              <span className="nums text-sm text-[color-mix(in_srgb,var(--metal-hi)_55%,transparent)]">
                @{s.handle}
              </span>
            </span>
            {/* The ladder itself: every rung dark until real points arrive. */}
            <span className="flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: RUNGS }, (_, r) => (
                <span
                  key={r}
                  className="rung h-4 w-1.5 rounded-[1px] bg-[color-mix(in_srgb,var(--metal-hi)_14%,transparent)]"
                  style={{ animationDelay: `${0.25 + r * 0.03}s` }}
                />
              ))}
            </span>
            <span className="nums w-10 text-right text-lg font-extrabold text-[var(--metal-hi)]">
              {s.points ?? "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color-mix(in_srgb,var(--engrave)_70%,transparent)]">
        {SEASON.label} is just kicking off. The ladder fills in as we play, and
        top finishers earn points toward the prize wall.
      </p>
    </section>
  );
}

/* Videos behind the cassette door. */
function Tape({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <section id="tape" className="seam scroll-mt-4 px-5 py-10 sm:px-7 sm:py-14">
        <PanelHead title="The tape" legend="PLAYBACK" />
        <a
          href="https://www.youtube.com/@BlueMilkGaming"
          target="_blank"
          rel="noopener noreferrer"
          className="bezel mt-8 inline-block px-6 py-3 font-extrabold text-[var(--engrave)]"
        >
          Watch on YouTube
        </a>
      </section>
    );
  }
  return (
    <section id="tape" className="seam scroll-mt-4 px-5 py-10 sm:px-7 sm:py-14">
      <PanelHead
        title="The tape"
        legend="PLAYBACK · 05 REELS"
        aside="New videos weekly, plus weekday lunchtime streams."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v, i) => (
          <Reel key={v.id} video={v} n={i + 1} />
        ))}
      </div>
    </section>
  );
}

function Reel({ video, n }: { video: Video; n: number }) {
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
      className="group flex flex-col border border-[var(--metal-lo)] bg-[color-mix(in_srgb,var(--metal-hi)_38%,transparent)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
    >
      <div className="flex items-center justify-between px-0.5 pb-2">
        <span className="engraved nums">REEL {String(n).padStart(2, "0")}</span>
        <span className="engraved nums">{date}</span>
      </div>
      {/* The window in the cassette door. */}
      <div className="recessed aspect-video overflow-hidden p-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YT thumb, optimizer disabled */}
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full rounded-[2px] object-cover"
        />
      </div>
      <h3 className="px-0.5 pb-0.5 pt-3 text-sm font-extrabold leading-snug decoration-2 underline-offset-4 group-hover:underline">
        {video.title}
      </h3>
    </a>
  );
}

/* Sponsors as maker plates riveted to the panel. */
function MakerPlates() {
  return (
    <section className="seam px-5 py-10 sm:px-7 sm:py-14">
      <PanelHead title="Backed by" legend="FITTED COMPONENTS" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PARTNERS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 border border-[var(--metal-lo)] bg-[color-mix(in_srgb,var(--metal-hi)_38%,transparent)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
          >
            <Screw className="shrink-0" />
            {/* The marks are white, so on metal they need the dark plate under them. */}
            <span className="recessed flex h-16 flex-1 items-center justify-center px-5 transition-opacity group-hover:opacity-85">
              <Image
                src={p.logo}
                alt={p.name}
                width={p.width}
                height={p.height}
                className="h-9 w-auto"
              />
            </span>
            <Screw className="shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}

function PanelHead({
  title,
  legend,
  aside,
}: {
  title: string;
  legend: string;
  aside?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="engraved">{legend}</div>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {aside && (
        <p className="max-w-xs text-sm leading-relaxed text-[color-mix(in_srgb,var(--engrave)_70%,transparent)]">
          {aside}
        </p>
      )}
    </div>
  );
}

/* Rear panel: the serial plate and the small print, where they live on a real
   piece of equipment. */
function RearPanel() {
  return (
    <footer className="seam bg-[color-mix(in_srgb,var(--metal-lo)_30%,transparent)] px-5 py-10 sm:px-7">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="max-w-sm text-xl font-extrabold tracking-tight">
            Pull up a seat at the table.
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[color-mix(in_srgb,var(--engrave)_75%,transparent)]">
            The whole community lives in Discord. Say hi, get the melee link,
            play the next Online Local.
          </p>
        </div>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bezel shrink-0 px-7 py-3.5 font-extrabold text-[var(--engrave)] transition-transform active:translate-y-px"
        >
          Join the Discord
        </a>
      </div>
      <nav className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
        {CHANNELS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="engraved hover:text-[var(--engrave)]"
          >
            {c.label}
          </a>
        ))}
      </nav>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--metal-lo)] pt-5">
        <p className="max-w-xl text-xs leading-relaxed text-[color-mix(in_srgb,var(--engrave)_70%,transparent)]">
          Blue Milk Gaming is a fan-run Star Wars: Unlimited community, formed
          2025. Star Wars: Unlimited is © its respective owners.
        </p>
        <div className="engraved nums flex items-center gap-3">
          <Screw />
          <span>SER. BMG-2025-01</span>
        </div>
      </div>
    </footer>
  );
}
