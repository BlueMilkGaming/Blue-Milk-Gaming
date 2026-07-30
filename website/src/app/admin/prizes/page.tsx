import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { pendingRedemptions, allPrizeRows } from "@/lib/prizes-db";
import { prizeById } from "@/lib/prizes";
import { PRIZE_WALL } from "@/data/prize-wall";
import { StoreStyles } from "../../store-styles";
import { AdminNav } from "../admin-nav";
import { RedemptionActions } from "./redemption-actions";
import { StockEditor } from "./stock-editor";

export const dynamic = "force-dynamic";

export default async function AdminPrizesPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const [pending, rows] = await Promise.all([pendingRedemptions(), allPrizeRows()]);
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin/prizes" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Redemptions</h1>
          {pending.length === 0 && <p className="mt-4 font-extrabold">Queue&apos;s empty.</p>}
          <ul className="mt-4 space-y-5">
            {pending.map((r) => (
              <li
                key={r.redemptionId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4"
              >
                <p className="font-extrabold">
                  {r.displayName}: {prizeById(r.prizeId)?.name ?? r.prizeId} (
                  {r.costAtRedemption.toLocaleString("en-US")} pts)
                </p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  requested {r.requestedAt.slice(0, 10)}
                </p>
                <RedemptionActions playerId={r.playerId} redemptionId={r.redemptionId} />
              </li>
            ))}
          </ul>
        </div>
        <div className="tilt-r taped paper mt-8 p-8">
          <h2 className="display text-4xl">Stock</h2>
          <ul className="mt-4 space-y-5">
            {PRIZE_WALL.map((item) => (
              <li
                key={item.id}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4"
              >
                <p className="font-extrabold">{item.name}</p>
                <StockEditor
                  prizeId={item.id}
                  stock={rows.get(item.id)?.stock}
                  hidden={!!rows.get(item.id)?.hidden}
                />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
