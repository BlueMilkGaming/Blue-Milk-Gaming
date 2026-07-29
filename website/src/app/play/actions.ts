"use server";
import { auth, signIn } from "@/lib/auth";
import { ensureAccount } from "@/lib/accounts";
import { joinOrCreate, leavePod, reportResult, flagResult } from "@/lib/pods-db";

type ActionResult = { error: string } | { ok: true };

async function run(work: () => Promise<void>): Promise<ActionResult> {
  try {
    await work();
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something slipped; try again." };
  }
}

export async function playSignInAction() {
  await signIn("discord", { redirectTo: "/play" });
}

export async function joinAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { error: "Sign in first." };
  return run(async () => {
    await ensureAccount(session.user.discordUserId, session.user.name);
    await joinOrCreate(session.user.discordUserId, session.user.name);
  });
}

export async function leaveAction(podId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { error: "Sign in first." };
  return run(() => leavePod(session.user.discordUserId, podId));
}

export async function reportAction(
  podId: string, roundIndex: number, matchIndex: number, winner: string, noShow = false,
): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { error: "Sign in first." };
  return run(() =>
    reportResult(session.user.discordUserId, podId, roundIndex, matchIndex, winner, noShow));
}

export async function flagAction(
  podId: string, roundIndex: number, matchIndex: number,
): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { error: "Sign in first." };
  return run(() => flagResult(session.user.discordUserId, podId, roundIndex, matchIndex));
}
