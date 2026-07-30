import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/accounts";
import { getBalance } from "@/lib/ledger";
import { allPrizeRows } from "@/lib/prizes-db";
import { DISCORD_URL } from "@/data/season";
import { PRIZE_WALL } from "@/data/prize-wall";
import { StoreStyles } from "../store-styles";
import { SiteHeader, SiteFooter } from "../site-chrome";
import { RedeemButton } from "./redeem-button";

/*
  The full prize wall (The Local world, DESIGN.md), priced per the approved
  pricing design (docs/superpowers/specs/2026-07-29-prize-wall-pricing-
  design.md), transactional per the redemption design (2026-07-30): stock
  from the Prize table, redemption in one conditional transaction.
*/

export const dynamic = "force-dynamic"; // session + live stock, never prerender

export const metadata: Metadata = {
  title: "The Prize Wall — Blue Milk Gaming",
  description:
    "Points from the weekly Online Local buy things off the prize wall.",
};

export default async function PrizeWallPage() {
  const [session, rows] = await Promise.all([auth(), allPrizeRows()]);
  const discordUserId = session?.user.discordUserId;
  const [account, balance] = discordUserId
    ? await Promise.all([getAccount(discordUserId), getBalance(discordUserId)])
    : [undefined, undefined];
  const linked = !!account?.meleeUserIdentity;
  const points = balance?.currencyBalance ?? 0;
  const items = PRIZE_WALL.filter((item) => !rows.get(item.id)?.hidden);
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <SiteHeader current="/prizes" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <span className="tape">The prize wall</span>
        <h1 className="display mt-6 text-[clamp(2.75rem,7vw,5rem)]">
          The wall
          <br />
          is up.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_75%,transparent)]">
          Top finishes at the Sunday Online Local earn points, and wins at the
          Tables add more. Points buy things right off this wall.
        </p>
        {session ? (
          linked ? (
            <p className="mt-4 text-lg font-extrabold text-[var(--accent)]">
              You have {points.toLocaleString("en-US")} pts to spend.
            </p>
          ) : (
            <p className="mt-4 text-lg font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)]">
              <Link href="/account" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">
                Link your melee results
              </Link>{" "}
              to spend your points.
            </p>
          )
        ) : (
          <p className="mt-4 text-lg font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)]">
            <Link href="/account" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">
              Sign in
            </Link>{" "}
            to spend your points.
          </p>
        )}
        <div className="pegboard mt-12 rounded-xl border-2 border-[color-mix(in_srgb,var(--paper)_40%,transparent)] p-8 shadow-[0_18px_40px_-18px_rgba(0,2,28,0.9)] sm:p-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const row = rows.get(item.id);
              const soldOut = row?.stock !== undefined && row.stock <= 0;
              return (
                <div
                  key={item.id}
                  className={`tilt-r paper p-6 pt-5 text-center${soldOut ? " opacity-60 grayscale" : ""}`}
                >
                  <span aria-hidden="true" className="mx-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--wall-deep)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--paper)_45%,var(--wall-deep))]" />
                  </span>
                  {item.imageUrl && (
                    // Pre-sized local images (public/prize-images); images.unoptimized
                    // is set, so next/image would add nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      className="mx-auto mt-4 aspect-square w-full max-w-44 object-contain"
                    />
                  )}
                  <p className="mt-4 text-xl font-extrabold leading-tight">{item.name}</p>
                  {item.by && (
                    <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                      from {item.by}
                    </p>
                  )}
                  <p className="mt-4 border-t-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-3 text-lg font-extrabold text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]">
                    {item.points.toLocaleString("en-US")} pts
                  </p>
                  {soldOut ? (
                    <p className="mt-3 inline-block bg-[color-mix(in_srgb,var(--ink)_15%,transparent)] px-3 py-1 text-sm font-extrabold">
                      Claimed
                    </p>
                  ) : linked ? (
                    points >= item.points ? (
                      <RedeemButton prizeId={item.id} points={item.points} />
                    ) : (
                      <p className="mt-3 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_50%,transparent)]">
                        Not enough points yet
                      </p>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="tilt-r mt-8 inline-block bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-4 py-2.5 text-sm font-extrabold">
            Redeem here and the shopkeeper will DM you on Discord to sort
            delivery. Small items ship together with your next redemption.
          </p>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-[var(--hot)] px-8 py-4 text-lg font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2"
          >
            Play for points Sunday
          </a>
          <Link
            href="/standings"
            className="font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          >
            Check the standings →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
