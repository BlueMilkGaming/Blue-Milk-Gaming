"use server";
import { auth, signIn, signOut } from "@/lib/auth";
import { requestClaim } from "@/lib/accounts";

export async function signInAction() {
  await signIn("discord", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function claimAction(
  prevState: { error: string } | { ok: true } | null,
  formData: FormData,
): Promise<{ error: string } | { ok: true } | null> {
  const session = await auth();
  if (!session) throw new Error("sign in first");
  const meleeUserIdentity = String(formData.get("meleeUserIdentity") ?? "");
  if (!meleeUserIdentity) return { error: "pick a name from the list" };
  try {
    await requestClaim(session.user.discordUserId, meleeUserIdentity);
    // No revalidatePath here: it would re-render the server tree and unmount
    // this form mid-response. The client renders the pending state itself;
    // the page is force-dynamic, so the next real navigation picks up
    // server truth with no staleness risk.
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "claim failed";
    return { error: message };
  }
}
