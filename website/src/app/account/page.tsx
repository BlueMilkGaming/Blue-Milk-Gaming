import Link from "next/link";
import { auth } from "@/lib/auth";
import { ensureAccount } from "@/lib/accounts";
import { getLeaderboard } from "@/lib/db";
import { getBalance } from "@/lib/ledger";
import { playerRedemptions } from "@/lib/prizes-db";
import { prizeById } from "@/lib/prizes";
import { StoreStyles } from "../store-styles";
import { SiteHeader, SiteFooter } from "../site-chrome";
import { signInAction, signOutAction } from "./actions";
import { ClaimFormClient } from "./claim-form";

export const dynamic = "force-dynamic"; // session-dependent, never prerender

export default async function AccountPage() {
  const session = await auth();
  return (
    <div className="store flex min-h-screen flex-col">
      <StoreStyles />
      <SiteHeader current="/account" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <span className="tape">Your card</span>
        {session ? (
          <SignedIn
            name={session.user.name}
            discordUserId={session.user.discordUserId}
            avatar={session.user.avatar}
          />
        ) : (
          <SignedOut />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function SignedOut() {
  return (
    <div className="tilt-l taped paper mt-8 p-8">
      <h1 className="display text-4xl">Sign in</h1>
      <p className="mt-4 leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
        Sign in with Discord to link your melee.gg results and pull up a chair
        at the tables.
      </p>
      <form action={signInAction}>
        <button className="mt-6 cursor-pointer rounded-full bg-[var(--hot)] px-6 py-3 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2">
          Sign in with Discord
        </button>
      </form>
    </div>
  );
}

async function SignedIn({
  name,
  discordUserId,
  avatar,
}: {
  name: string;
  discordUserId: string;
  avatar: string | null;
}) {
  const [account, balance, redemptions] = await Promise.all([
    ensureAccount(discordUserId, name, avatar),
    getBalance(discordUserId),
    playerRedemptions(discordUserId),
  ]);
  return (
    <div className="tilt-l taped paper mt-8 p-8">
      <h1 className="display text-4xl">{name}</h1>
      {account.meleeUserIdentity ? (
        <p className="mt-4 font-extrabold">Linked to your melee results. You&apos;re all set.</p>
      ) : account.pendingClaim ? (
        <p className="mt-4 font-extrabold">Claim submitted. It counts once the shopkeeper checks the list.</p>
      ) : (
        <ClaimForm />
      )}
      <p className="mt-6 border-t-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-4 text-lg font-extrabold">
        {balance.currencyBalance.toLocaleString("en-US")} pts to spend.{" "}
        <Link href="/prizes" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">
          See the wall
        </Link>
      </p>
      {redemptions.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
            Redemptions
          </h2>
          <ul className="mt-2 space-y-2">
            {redemptions.map((r) => (
              <li key={r.redemptionId} className="text-sm font-extrabold">
                {prizeById(r.prizeId)?.name ?? r.prizeId}, {r.costAtRedemption.toLocaleString("en-US")} pts,{" "}
                {r.status}, {r.requestedAt.slice(0, 10)}
                {r.note && <>: &quot;{r.note}&quot;</>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form action={signOutAction}>
        <button className="mt-8 cursor-pointer text-sm font-extrabold underline transition-colors hover:text-[var(--accent)]">
          Sign out
        </button>
      </form>
    </div>
  );
}

async function ClaimForm() {
  const players = await getLeaderboard("all-time");
  const playerProps = players.map((p) => ({
    meleeUserIdentity: p.meleeUserIdentity,
    displayName: p.displayName,
  }));
  return <ClaimFormClient players={playerProps} />;
}
