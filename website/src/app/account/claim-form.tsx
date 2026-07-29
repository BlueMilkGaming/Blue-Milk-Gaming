"use client";
import { useActionState } from "react";
import { claimAction } from "./actions";

export function ClaimFormClient({
  players,
}: {
  players: { meleeUserIdentity: string; displayName: string }[];
}) {
  const [state, formAction] = useActionState(claimAction, null);

  return (
    <form action={formAction} className="mt-4">
      <label className="block text-sm font-extrabold" htmlFor="melee-name">
        Played a Sunday before? Pick your melee name to link your results:
      </label>
      <select id="melee-name" name="meleeUserIdentity" className="mt-2 w-full border-2 border-[var(--ink)] bg-transparent p-2 font-extrabold">
        <option value="">…</option>
        {players.map((p) => (
          <option key={p.meleeUserIdentity} value={p.meleeUserIdentity}>{p.displayName}</option>
        ))}
      </select>
      <button className="mt-4 rounded-full bg-[var(--hot)] px-5 py-2.5 font-extrabold text-[var(--ink)]">
        Claim this name
      </button>
      {state?.error && (
        <p className="mt-3 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">
          {state.error}
        </p>
      )}
    </form>
  );
}
