"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  fulfilRedemption, cancelRedemption, setStock, clearStock, setHidden,
} from "@/lib/prizes-db";

type ActionState = { error: string } | null;

function failure(err: unknown, fallback: string): ActionState {
  return { error: err instanceof Error ? err.message : fallback };
}

export async function fulfilAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await fulfilRedemption(String(formData.get("playerId")), String(formData.get("redemptionId")));
    revalidatePath("/admin/prizes");
    revalidatePath("/admin");
    return null;
  } catch (err) {
    return failure(err, "fulfil failed");
  }
}

export async function cancelAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  try {
    await cancelRedemption(
      String(formData.get("playerId")),
      String(formData.get("redemptionId")),
      note || undefined,
    );
    revalidatePath("/admin/prizes");
    revalidatePath("/admin");
    return null;
  } catch (err) {
    return failure(err, "cancel failed");
  }
}

export async function setStockAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const stock = Number(formData.get("stock"));
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a whole number, 0 or more." };
  try {
    await setStock(String(formData.get("prizeId")), stock);
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "stock update failed");
  }
}

export async function clearStockAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await clearStock(String(formData.get("prizeId")));
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "stock update failed");
  }
}

export async function toggleHiddenAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await setHidden(String(formData.get("prizeId")), formData.get("hidden") === "true");
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "visibility update failed");
  }
}
