"use server";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/lib/auth";
import { requestClaim } from "@/lib/accounts";

export async function signInAction() {
  await signIn("discord", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function claimAction(
  prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await auth();
  if (!session) throw new Error("sign in first");
  const meleeUserIdentity = String(formData.get("meleeUserIdentity") ?? "");
  if (!meleeUserIdentity) return { error: "pick a name from the list" };
  try {
    await requestClaim(session.user.discordUserId, meleeUserIdentity);
    revalidatePath("/account");
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "claim failed";
    return { error: message };
  }
}
