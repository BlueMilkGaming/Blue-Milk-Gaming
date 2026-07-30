"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { redeem } from "@/lib/prizes-db";

export async function redeemAction(
  prevState: { error: string } | { ok: true } | null,
  formData: FormData,
): Promise<{ error: string } | { ok: true } | null> {
  const session = await auth();
  if (!session) return { error: "Sign in on your card first." };
  const prizeId = String(formData.get("prizeId") ?? "");
  try {
    await redeem(session.user.discordUserId, session.user.name, prizeId);
    revalidatePath("/prizes");
    revalidatePath("/admin/prizes");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "redemption failed";
    return { error: message };
  }
}
