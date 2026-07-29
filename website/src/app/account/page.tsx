import { auth } from "@/lib/auth";
import { ensureAccount } from "@/lib/accounts";
import { getLeaderboard } from "@/lib/db";
import { StoreStyles } from "../store-styles";
import { signInAction, signOutAction } from "./actions";
import { ClaimFormClient } from "./claim-form";

export const dynamic = "force-dynamic"; // session-dependent, never prerender

export default async function AccountPage() {
  const session = await auth();
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Your card</span>
        {session ? <SignedIn name={session.user.name} discordUserId={session.user.discordUserId} /> : <SignedOut />}
      </main>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="tilt-l taped paper mt-8 p-8">
      <h1 className="display text-4xl">Sign in</h1>
      <p className="mt-4 leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
        Sign in with Discord to link your melee.gg results and, soon, pull up a
        chair at the tables.
      </p>
      <form action={signInAction}>
        <button className="mt-6 cursor-pointer rounded-full bg-[var(--hot)] px-6 py-3 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2">
          Sign in with Discord
        </button>
      </form>
    </div>
  );
}

async function SignedIn({ name, discordUserId }: { name: string; discordUserId: string }) {
  const account = await ensureAccount(discordUserId, name);
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
