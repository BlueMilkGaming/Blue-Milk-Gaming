import { auth } from "@/lib/auth";
import { StoreStyles } from "../store-styles";
import { SiteHeader, SiteFooter } from "../site-chrome";
import { playSignInAction } from "./actions";
import { PlayClient } from "./play-client";

export const dynamic = "force-dynamic"; // session-dependent, never prerender

export default async function PlayPage() {
  const session = await auth();
  return (
    <div className="store flex min-h-screen flex-col">
      <StoreStyles />
      <SiteHeader current="/play" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <span className="tape">The tables</span>
        {session ? <PlayClient /> : <SignedOut />}
      </main>
      <SiteFooter />
    </div>
  );
}

function SignedOut() {
  return (
    <div className="tilt-l taped paper mt-8 p-8">
      <h1 className="display text-4xl">Pull up a chair</h1>
      <p className="mt-4 leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
        Eight players sit down, the site runs three quick rounds, and every win
        pays points toward the prize wall. Coordinate each match in Discord,
        report here when you&apos;re done. Sign in with Discord to play.
      </p>
      <form action={playSignInAction}>
        <button className="mt-6 cursor-pointer rounded-full bg-[var(--hot)] px-6 py-3 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2">
          Sign in with Discord
        </button>
      </form>
    </div>
  );
}
