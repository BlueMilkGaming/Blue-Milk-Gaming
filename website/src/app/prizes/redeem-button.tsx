"use client";
import { useActionState, useState } from "react";
import { redeemAction } from "./actions";

export function RedeemButton({ prizeId, points }: { prizeId: string; points: number }) {
  const [state, formAction, pending] = useActionState(redeemAction, null);
  const [armed, setArmed] = useState(false);
  return (
    <div className="mt-3">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!armed) {
            e.preventDefault();
            setArmed(true);
          } else {
            setArmed(false);
          }
        }}
      >
        <input type="hidden" name="prizeId" value={prizeId} />
        <button
          disabled={pending}
          className="cursor-pointer rounded-full bg-[var(--hot)] px-5 py-2 text-sm font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:cursor-not-allowed"
        >
          {pending
            ? "Redeeming…"
            : armed
              ? `Spend ${points.toLocaleString("en-US")} pts?`
              : "Redeem"}
        </button>
      </form>
      <div aria-live="polite">
        {armed && !pending && (
          <p className="sr-only">
            Press the button again to confirm spending {points.toLocaleString("en-US")} points.
          </p>
        )}
        {state && "error" in state && (
          <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">
            {state.error}
          </p>
        )}
        {state && "ok" in state && (
          <p className="mt-2 text-sm font-extrabold">
            Yours. The shopkeeper will DM you on Discord.
          </p>
        )}
      </div>
    </div>
  );
}
