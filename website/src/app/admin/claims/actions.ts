"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { resolveClaim } from "@/lib/accounts";

async function requireAdmin() {
  const session = await auth();
  // Server-side gate (CLAUDE.md): the page hides itself too, but this is the wall.
  if (!session?.user.isAdmin) throw new Error("admins only");
}

export async function approveAction(
  prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  await requireAdmin();
  const discordUserId = String(formData.get("discordUserId"));
  try {
    await resolveClaim(discordUserId, true);
    revalidatePath("/admin/claims");
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "approval failed";
    return { error: message };
  }
}

export async function rejectAction(
  prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  await requireAdmin();
  const discordUserId = String(formData.get("discordUserId"));
  try {
    await resolveClaim(discordUserId, false);
    revalidatePath("/admin/claims");
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "rejection failed";
    return { error: message };
  }
}
