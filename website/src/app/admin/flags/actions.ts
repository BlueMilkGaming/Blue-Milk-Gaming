"use server";
// Errors travel as return values: Next masks messages thrown from server
// actions in production (same reason claimAction returns { error }).
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { resolveFlag } from "@/lib/pods-db";

export async function resolveFlagAction(
  podId: string, roundIndex: number, matchIndex: number,
  decision: "uphold" | "overturn" | "void",
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user.isAdmin) return { error: "admins only" };
  try {
    await resolveFlag(podId, roundIndex, matchIndex, decision);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "resolution failed" };
  }
  revalidatePath("/admin/flags");
  return { ok: true };
}
