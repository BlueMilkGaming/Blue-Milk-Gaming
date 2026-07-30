"use client";
import { useActionState } from "react";
import { fulfilAction, cancelAction } from "./actions";

export function RedemptionActions({ playerId, redemptionId }: { playerId: string; redemptionId: string }) {
  const [fulfilState, fulfilFormAction, fulfilPending] = useActionState(fulfilAction, null);
  const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelAction, null);
  const busy = fulfilPending || cancelPending;
  return (
    <div className="mt-2">
      <span className="flex flex-wrap items-center gap-2">
        <form action={fulfilFormAction}>
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="redemptionId" value={redemptionId} />
          <button
            disabled={busy}
            className="cursor-pointer rounded-full bg-[var(--hot)] px-4 py-1.5 text-sm font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:cursor-not-allowed"
          >
            {fulfilPending ? "Fulfilling…" : "Fulfil"}
          </button>
        </form>
        <form action={cancelFormAction} className="flex items-center gap-2">
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="redemptionId" value={redemptionId} />
          <input
            name="note"
            placeholder="note (optional)"
            className="w-36 border-2 border-[color-mix(in_srgb,var(--ink)_30%,transparent)] px-2 py-1 text-sm font-extrabold"
          />
          <button
            disabled={busy}
            className="cursor-pointer px-1 text-sm font-extrabold underline transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed"
          >
            {cancelPending ? "Cancelling…" : "Cancel & refund"}
          </button>
        </form>
      </span>
      {(fulfilState?.error || cancelState?.error) && (
        <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">
          {fulfilState?.error || cancelState?.error}
        </p>
      )}
    </div>
  );
}
