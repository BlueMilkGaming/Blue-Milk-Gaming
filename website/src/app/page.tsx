import Image from "next/image";
import { getLatestVideos, type Video } from "@/lib/youtube";
import { FIXTURE, ROSTER, SEASON, PARTNERS, CHANNELS, DISCORD_URL } from "@/data/season";

/*
  DIRECTION — Club Season Program (Persuade)
  THESIS: Blue Milk Gaming as a sports club, not a software product — a recurring
    weekly season with a league table. Refuses the dark-neon esports hero.
  OWN-WORLD: Deep Space navy fields with tonal panel/recess steps, broadcast
    matchday graphics — sharp hairline rectangles, tracked-caps labels, gold
    reserved for the live state and the Discord CTA, tabular data, Hubot Sans only.
  STORY: A first-timer sees a real recurring fixture + season, meets the squad in
    their new kit, sees the table and the channel, and joins the Discord as a supporter.
  FIRST VIEWPORT: MATCHDAY label, "ONLINE LOCAL" at display scale with the live
    Sunday fixture board and the gold "Join the Discord" as the primary action.
  FORM: club season program (grounded #3, assigned); broadcast lower-third staging;
    seed 729199fc.
*/

export default async function Home() {
  const videos = await getLatestVideos(5);
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
      <SiteHeader />
      <main>
        <Matchday />
        <Squad />
        <Table />
        <Watch videos={videos} />
        <Partners />
      </main>
      <SiteFooter />
    </div>
  );
}

function DiscordButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center bg-naboo px-6 py-3 font-extrabold text-deep-space transition-transform hover:-translate-y-0.5 ${className}`}
    >
      Join the Discord
    </a>
  );
}

function SiteHeader() {
  const nav = [
    { label: "Squad", href: "#squad" },
    { label: "Table", href: "#table" },
    { label: "Watch", href: "#watch" },
  ];
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <Image
        src="/brand/logo-horizontal.png"
        alt="Blue Milk Gaming"
        width={1200}
        height={453}
        className="h-9 w-auto sm:h-10"
        priority
      />
      <nav className="hidden items-center gap-7 md:flex">
        {nav.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="text-sm font-medium text-hoth/70 transition-colors hover:text-blue-milk"
          >
            {n.label}
          </a>
        ))}
      </nav>
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-blue-milk/40 px-4 py-2 text-sm font-extrabold text-blue-milk transition-colors hover:bg-blue-milk hover:text-deep-space"
      >
        Discord
      </a>
    </header>
  );
}

function Matchday() {
  return (
    <section className="relative -mx-5 mt-2 border-y border-blue-milk/15 px-5 py-16 sm:-mx-8 sm:px-8 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="kicker rise" style={{ animationDelay: "0.02s" }}>
            Matchday · {SEASON.label}
          </p>
          <h1
            className="rise mt-4 text-6xl font-extrabold leading-[0.92] tracking-[-0.03em] sm:text-7xl"
            style={{ animationDelay: "0.08s" }}
          >
            Online
            <br />
            Local
          </h1>
          <p
            className="rise mt-5 max-w-md text-lg text-hoth/70"
            style={{ animationDelay: "0.16s" }}
          >
            Our weekly Star Wars: Unlimited tournament — every Sunday night, four
            rounds of Swiss, one table that runs all season.
          </p>
          <div
            className="rise mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "0.24s" }}
          >
            <DiscordButton />
            <a
              href="https://www.youtube.com/@BlueMilkGaming"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-blue-milk/40 px-6 py-3 font-extrabold text-blue-milk transition-colors hover:bg-blue-milk hover:text-deep-space"
            >
              Watch the channel
            </a>
          </div>
        </div>

        {/* Broadcast fixture board */}
        <div
          className="rise border border-blue-milk/20 bg-panel shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
          style={{ animationDelay: "0.12s" }}
        >
          <div className="flex items-center justify-between border-b border-blue-milk/15 px-5 py-3">
            <span className="kicker">Next Fixture</span>
            <span className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-wider text-naboo">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-naboo" />
              This Sunday
            </span>
          </div>
          <div className="px-6 py-7">
            <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-blue-milk">
              {FIXTURE.day}
            </p>
            <p className="nums mt-1 text-5xl font-extrabold tracking-tight">
              6:30 <span className="text-blue-milk">PM CT</span>
            </p>
            <dl className="mt-6 divide-y divide-blue-milk/10 border-t border-blue-milk/10">
              <FixtureRow label="Competition" value={FIXTURE.competition} />
              <FixtureRow label="Format" value={FIXTURE.format} />
              <FixtureRow label="Venue" value={FIXTURE.venue} />
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function FixtureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-sm text-hoth/60">{label}</dt>
      <dd className="text-sm font-extrabold text-hoth">{value}</dd>
    </div>
  );
}

function Squad() {
  return (
    <section id="squad" className="scroll-mt-8 border-b border-blue-milk/15 py-20 sm:py-28">
      <SectionHead kicker="The Squad" title="New kit. Same crew." />
      <div className="mt-10 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <figure className="relative overflow-hidden border border-blue-milk/20 bg-recess">
          <Image
            src="/brand/crew.jpg"
            alt="Blue Milk Gaming members in the team jersey"
            width={1200}
            height={1600}
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-deep-space to-transparent px-5 py-4 text-xs font-extrabold uppercase tracking-wider text-hoth/80">
            The 2026 kit
          </figcaption>
        </figure>
        <ul className="divide-y divide-blue-milk/12 border-y border-blue-milk/15">
          {ROSTER.map((m) => (
            <li key={m.handle} className="flex items-baseline gap-5 py-5">
              <span className="nums w-12 shrink-0 text-2xl font-extrabold text-blue-milk">
                {m.number}
              </span>
              <span className="flex-1">
                <span className="block text-xl font-extrabold">{m.name}</span>
                <span className="text-sm text-hoth/60">@{m.handle}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Table() {
  return (
    <section id="table" className="scroll-mt-8 border-b border-blue-milk/15 py-20 sm:py-28">
      <SectionHead
        kicker={`${SEASON.label} · Standings`}
        title="The Table"
        aside="Points sync from melee.gg when the leaderboard goes live."
      />
      <div className="mt-10 overflow-hidden border border-blue-milk/15">
        <div className="grid grid-cols-[3rem_1fr_5rem] items-center gap-4 border-b border-blue-milk/15 bg-panel px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-blue-milk">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Pts</span>
        </div>
        {SEASON.standings.map((s, i) => (
          <div
            key={s.handle}
            className="grid grid-cols-[3rem_1fr_5rem] items-center gap-4 border-b border-blue-milk/10 px-5 py-4 last:border-b-0 odd:bg-recess/50"
          >
            <span className="nums text-lg font-extrabold text-hoth/50">{i + 1}</span>
            <span>
              <span className="font-extrabold">{s.name}</span>{" "}
              <span className="text-sm text-hoth/50">@{s.handle}</span>
            </span>
            <span className="nums text-right text-lg font-extrabold text-hoth/40">
              {s.points ?? "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-hoth/50">
        Season 01 is just kicking off. Standings fill in as we play — top
        finishers earn points toward the prize wall.
      </p>
    </section>
  );
}

function Watch({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <section id="watch" className="scroll-mt-8 border-b border-blue-milk/15 py-20 sm:py-28">
        <SectionHead kicker="Latest" title="From the channel" />
        <a
          href="https://www.youtube.com/@BlueMilkGaming"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-flex border border-blue-milk/40 px-6 py-3 font-extrabold text-blue-milk transition-colors hover:bg-blue-milk hover:text-deep-space"
        >
          Watch on YouTube
        </a>
      </section>
    );
  }
  const [feature, ...rest] = videos;
  return (
    <section id="watch" className="scroll-mt-8 border-b border-blue-milk/15 py-20 sm:py-28">
      <SectionHead
        kicker="Latest"
        title="From the channel"
        aside="New videos weekly, plus weekday lunchtime streams."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <VideoCard video={feature} featured />
        <div className="grid gap-6 sm:grid-cols-2">
          {rest.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoCard({ video, featured = false }: { video: Video; featured?: boolean }) {
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
      className="group flex flex-col border border-blue-milk/15 bg-panel transition-colors hover:border-blue-milk/40"
    >
      <div className="relative aspect-video overflow-hidden bg-recess">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote YT thumb, optimizer disabled */}
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className={`flex flex-col gap-1.5 p-4 ${featured ? "sm:p-6" : ""}`}>
        <span className="nums text-xs font-extrabold uppercase tracking-wider text-blue-milk">
          {date}
        </span>
        <span
          className={`font-extrabold leading-snug text-hoth transition-colors group-hover:text-blue-milk ${
            featured ? "text-2xl" : "line-clamp-2"
          }`}
        >
          {video.title}
        </span>
      </div>
    </a>
  );
}

function Partners() {
  return (
    <section className="py-20 sm:py-24">
      <SectionHead kicker="Club Partners" title="Backed by" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PARTNERS.map((p) => (
          <div
            key={p.name}
            className="flex items-baseline justify-between border border-blue-milk/15 bg-panel px-6 py-6"
          >
            <span className="text-xl font-extrabold">{p.name}</span>
            <span className="text-sm text-hoth/60">{p.contribution}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="-mx-5 mt-auto border-t border-blue-milk/15 bg-recess px-5 py-14 sm:-mx-8 sm:px-8">
      <div className="flex flex-col items-start justify-between gap-10 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Pull up a seat at the table.
          </h2>
          <p className="mt-2 max-w-sm text-hoth/60">
            The whole community lives in Discord — say hi, get the melee link,
            play the next Online Local.
          </p>
        </div>
        <DiscordButton className="shrink-0" />
      </div>
      <nav className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
        {CHANNELS.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-extrabold text-hoth/70 transition-colors hover:text-blue-milk"
          >
            {c.label}
          </a>
        ))}
      </nav>
      <p className="mt-10 text-xs text-hoth/55">
        Blue Milk Gaming — a fan-run Star Wars: Unlimited community, formed 2025.
        Star Wars: Unlimited is © its respective owners.
      </p>
    </footer>
  );
}

function SectionHead({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="kicker">{kicker}</p>
        <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.02em] sm:text-5xl">
          {title}
        </h2>
      </div>
      {aside && <p className="max-w-xs text-sm text-hoth/60">{aside}</p>}
    </div>
  );
}
