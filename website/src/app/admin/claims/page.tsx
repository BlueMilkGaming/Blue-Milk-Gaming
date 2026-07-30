import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPendingClaims } from "@/lib/accounts";
import { getLeaderboard } from "@/lib/db";
import { StoreStyles } from "../../store-styles";
import { AdminNav } from "../admin-nav";
import { ClaimActions } from "./claim-actions";

export const dynamic = "force-dynamic";

export default async function ClaimsPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const [pending, players] = await Promise.all([
    listPendingClaims(),
    getLeaderboard("all-time"),
  ]);
  const nameOf = new Map(players.map((p) => [p.meleeUserIdentity, p.displayName]));
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin/claims" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Claims</h1>
          {pending.length === 0 && (
            <p className="mt-4 font-extrabold">Queue&apos;s empty.</p>
          )}
          <ul className="mt-4 space-y-4">
            {pending.map((a) => (
              <li
                key={a.discordUserId}
                className="flex items-center justify-between gap-4 border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-3"
              >
                <span className="font-extrabold">
                  {a.displayName} → {nameOf.get(a.pendingClaim!) ?? a.pendingClaim}
                </span>
                <ClaimActions discordUserId={a.discordUserId} />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
