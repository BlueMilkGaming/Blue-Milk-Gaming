"use client";
import { useActionState } from "react";
import { approveAction, rejectAction } from "./actions";

export function ClaimActions({ discordUserId }: { discordUserId: string }) {
  const [approveState, approveFormAction, approvePending] = useActionState(
    approveAction,
    null,
  );
  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    rejectAction,
    null,
  );

  return (
    <div>
      <span className="flex gap-2">
        <form action={approveFormAction}>
          <input type="hidden" name="discordUserId" value={discordUserId} />
          <button
            disabled={approvePending || rejectPending}
            className="rounded-full bg-[var(--hot)] px-4 py-1.5 text-sm font-extrabold text-[var(--ink)]"
          >
            {approvePending ? "Approving…" : "Approve"}
          </button>
        </form>
        <form action={rejectFormAction}>
          <input type="hidden" name="discordUserId" value={discordUserId} />
          <button
            disabled={approvePending || rejectPending}
            className="px-2 text-sm font-extrabold underline"
          >
            {rejectPending ? "Rejecting…" : "Reject"}
          </button>
        </form>
      </span>
      {(approveState?.error || rejectState?.error) && (
        <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">
          {approveState?.error || rejectState?.error}
        </p>
      )}
    </div>
  );
}
