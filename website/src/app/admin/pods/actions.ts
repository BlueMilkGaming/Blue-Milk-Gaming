"use server";
// Errors travel as return values: Next masks messages thrown from server
// actions in production (same reason resolveFlagAction returns { error }).
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { removeSeat } from "@/lib/pods-db";

export async function kickAction(
  podId: string, playerId: string,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user.isAdmin) return { error: "admins only" };
  try {
    await removeSeat(podId, playerId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "kick failed" };
  }
  revalidatePath("/admin/pods");
  return { ok: true };
}
