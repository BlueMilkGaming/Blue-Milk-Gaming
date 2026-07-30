"use client";
import { useActionState } from "react";
import { setStockAction, clearStockAction, toggleHiddenAction } from "./actions";

export function StockEditor({ prizeId, stock, hidden }: { prizeId: string; stock?: number; hidden: boolean }) {
  const [setState, setFormAction, setPending] = useActionState(setStockAction, null);
  const [clearState, clearFormAction, clearPending] = useActionState(clearStockAction, null);
  const [hideState, hideFormAction, hidePending] = useActionState(toggleHiddenAction, null);
  const busy = setPending || clearPending || hidePending;
  const error = setState?.error || clearState?.error || hideState?.error;
  return (
    <div className="mt-2">
      <span className="flex flex-wrap items-center gap-2">
        <form action={setFormAction} className="flex items-center gap-2">
          <input type="hidden" name="prizeId" value={prizeId} />
          <input
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={stock}
            aria-label={`Stock count for ${prizeId}`}
            className="w-20 border-2 border-[color-mix(in_srgb,var(--ink)_30%,transparent)] px-2 py-1 text-sm font-extrabold"
          />
          <button
            disabled={busy}
            className="cursor-pointer rounded-full bg-[var(--hot)] px-4 py-1.5 text-sm font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:cursor-not-allowed"
          >
            Set
          </button>
        </form>
        {stock !== undefined && (
          <form action={clearFormAction}>
            <input type="hidden" name="prizeId" value={prizeId} />
            <button
              disabled={busy}
              className="cursor-pointer px-1 text-sm font-extrabold underline transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed"
            >
              Unlimited
            </button>
          </form>
        )}
        <form action={hideFormAction}>
          <input type="hidden" name="prizeId" value={prizeId} />
          <input type="hidden" name="hidden" value={hidden ? "" : "true"} />
          <button
            disabled={busy}
            className="cursor-pointer px-1 text-sm font-extrabold underline transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed"
          >
            {hidden ? "Show" : "Hide"}
          </button>
        </form>
        <span className="text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
          {hidden ? "hidden" : stock === undefined ? "unlimited" : stock === 0 ? "sold out" : `${stock} left`}
        </span>
      </span>
      {error && (
        <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">{error}</p>
      )}
    </div>
  );
}
