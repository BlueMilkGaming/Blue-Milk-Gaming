import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPendingClaims } from "@/lib/accounts";
import { pendingRedemptions } from "@/lib/prizes-db";
import { unresolvedFlags } from "@/lib/pods-db";
import { clubDay } from "@/lib/pods";
import { StoreStyles } from "../store-styles";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

// Flags live on recent pods; a week of days covers any realistic dispute.
const LOOKBACK_DAYS = 7;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const days = Array.from({ length: LOOKBACK_DAYS }, (_, i) =>
    clubDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const [claims, redemptions, flags] = await Promise.all([
    listPendingClaims(), pendingRedemptions(), unresolvedFlags(days),
  ]);
  const sections = [
    { label: "Claims", href: "/admin/claims", pending: claims.length },
    { label: "Flags", href: "/admin/flags", pending: flags.length },
    { label: "Prizes", href: "/admin/prizes", pending: redemptions.length },
  ];
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Back office</h1>
          <ul className="mt-4 space-y-4">
            {sections.map((s) => (
              <li
                key={s.href}
                className="flex items-center justify-between gap-4 border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-3"
              >
                <Link href={s.href} className="font-extrabold underline transition-colors hover:text-[var(--accent)]">
                  {s.label}
                </Link>
                <span className={`font-extrabold${s.pending === 0 ? " text-[color-mix(in_srgb,var(--ink)_50%,transparent)]" : ""}`}>
                  {s.pending === 0 ? "clear" : `${s.pending} pending`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
