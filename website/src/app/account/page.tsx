import { auth } from "@/lib/auth";
import { ensureAccount } from "@/lib/accounts";
import { getLeaderboard } from "@/lib/db";
import { StoreStyles } from "../store-styles";
import { signInAction, signOutAction, claimAction } from "./actions";

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
        <button className="mt-6 rounded-full bg-[var(--hot)] px-6 py-3 font-extrabold text-[var(--ink)]">
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
        <button className="mt-8 text-sm font-extrabold underline">Sign out</button>
      </form>
    </div>
  );
}

async function ClaimForm() {
  const players = await getLeaderboard("all-time");
  return (
    <form action={claimAction} className="mt-4">
      <label className="block text-sm font-extrabold" htmlFor="melee-name">
        Played a Sunday before? Pick your melee name to link your results:
      </label>
      <select id="melee-name" name="meleeUserIdentity" className="mt-2 w-full border-2 border-[var(--ink)] bg-transparent p-2 font-extrabold">
        <option value="">…</option>
        {players.map((p) => (
          <option key={p.meleeUserIdentity} value={p.meleeUserIdentity}>{p.displayName}</option>
        ))}
      </select>
      <button className="mt-4 rounded-full bg-[var(--hot)] px-5 py-2.5 font-extrabold text-[var(--ink)]">
        Claim this name
      </button>
    </form>
  );
}
