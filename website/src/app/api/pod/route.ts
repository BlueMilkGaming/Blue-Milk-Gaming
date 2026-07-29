// The live-updates channel (pods spec): /play and the home Tables section
// poll this instead of holding sockets. Also where lazy expiry gets applied,
// since tablesSnapshot runs on every poll.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/accounts";
import { tablesSnapshot, getPod } from "@/lib/pods-db";
import { paidToday } from "@/lib/ledger";
import { clubDay, type PodRow } from "@/lib/pods";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();

  // ?id= : the final state of one pod, for the /play done summary after close
  // clears the caller's activePodId. Only served to someone seated in it.
  const podId = new URL(req.url).searchParams.get("id");
  if (podId) {
    if (!session) return NextResponse.json({ pod: null });
    const pod = await getPod(podId);
    const seated = pod.seats.some((s) => s.playerId === session.user.discordUserId);
    return NextResponse.json({ pod: seated ? { ...pod, seatIds: undefined } : null });
  }

  const tables = await tablesSnapshot();

  let you: PodRow | null = null;
  let paid = 0;
  if (session) {
    const account = await getAccount(session.user.discordUserId);
    if (account?.activePodId) {
      const pod = await getPod(account.activePodId);
      // The pointer can outlive the pod state by one poll (lazy close in
      // flight); only show a live pod.
      if (pod.status === "filling" || pod.status === "playing") you = pod;
    }
    paid = await paidToday(session.user.discordUserId, clubDay());
  }

  return NextResponse.json({
    lobby: tables.lobby && {
      podId: tables.lobby.podId,
      seats: tables.lobby.seats.map((s) => s.displayName),
      createdAt: tables.lobby.createdAt,
    },
    playingCount: tables.playingCount,
    you: you && { ...you, seatIds: undefined }, // Sets do not survive JSON; seats[] carries the same info
    yourId: session?.user.discordUserId ?? null,
    paidToday: paid,
  });
}
