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

export async function claimAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("sign in first");
  const meleeUserIdentity = String(formData.get("meleeUserIdentity") ?? "");
  if (!meleeUserIdentity) throw new Error("pick a name from the list");
  await requestClaim(session.user.discordUserId, meleeUserIdentity);
  revalidatePath("/account");
}
