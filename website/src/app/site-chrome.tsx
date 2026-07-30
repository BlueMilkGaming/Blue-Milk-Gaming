import Image from "next/image";
import Link from "next/link";
import { CHANNELS, DISCORD_URL } from "@/data/season";
import { TablesNavDot } from "./tables-live";

/*
  The store's fixed fittings (The Local world, DESIGN.md): the sign over the
  door and the fine print by the exit. Every room hangs the same ones, so
  wherever a visitor stands they can see the way to any other part of the
  store.
*/

const NAV = [
  { label: "The Tables", href: "/play" },
  { label: "The Board", href: "/standings" },
  { label: "The Prize Wall", href: "/prizes" },
  // A static link on purpose: session-aware chrome would force every page
  // dynamic and kill the home page's prerender. /account sorts both states.
  { label: "Your Card", href: "/account" },
];

// Single source for the store URL (merch.bluemilkgaming.com).
const SHOP = CHANNELS.find((c) => c.label === "Merch");

export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-5 sm:px-8">
      <Link href="/" aria-label="Blue Milk Gaming home">
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
        className="rounded-full bg-[var(--hot)] px-5 py-2.5 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 md:order-last"
      >
        Discord
      </a>
      {/* Full row of its own below md; inline between logo and Discord above. */}
      <nav className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 md:w-auto md:gap-7">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={n.href === current ? "page" : undefined}
            className={
              n.href === current
                ? "font-extrabold text-[var(--paper)] underline decoration-[var(--accent)] decoration-2 underline-offset-8"
                : "font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
            }
          >
            {n.label}
            {n.href === "/play" && <TablesNavDot />}
          </Link>
        ))}
        {SHOP && (
          <a
            href={SHOP.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          >
            Merch
          </a>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
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
