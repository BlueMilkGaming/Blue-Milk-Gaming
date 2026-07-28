import Image from "next/image";

const LINKS = [
  { label: "YouTube", href: "https://www.youtube.com/@BlueMilkGaming" },
  { label: "Discord", href: "https://discord.gg/pyVPPHwemq" },
  { label: "Patreon", href: "https://www.patreon.com/cw/BlueMilkGaming" },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <Image
        src="/brand/logo-horizontal.png"
        alt="Blue Milk Gaming"
        width={4000}
        height={1512}
        className="h-auto w-full max-w-lg"
        priority
      />

      <div className="flex flex-col gap-3">
        <p className="text-xl font-extrabold text-blue-milk sm:text-2xl">
          Star Wars: Unlimited content &amp; community
        </p>
        <p className="max-w-lg text-hoth/70">
          Home of the <span className="text-naboo">Online Local</span> — our
          weekly Sunday night tournament. Leaderboard and prize wall coming
          soon.
        </p>
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-3">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-blue-milk/40 px-5 py-2 font-medium text-blue-milk transition-colors hover:bg-blue-milk hover:text-deep-space"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </main>
  );
}
