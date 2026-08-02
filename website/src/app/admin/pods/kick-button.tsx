"use client";
import { useState, useTransition } from "react";
import { kickAction } from "./actions";

export function KickButton(props: { podId: string; playerId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const kick = () =>
    start(async () => {
      setError("");
      const result = await kickAction(props.podId, props.playerId);
      if ("error" in result) setError(result.error);
    });
  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={kick} disabled={pending}
        className="cursor-pointer rounded-full border-2 border-[var(--ink)] px-3 py-0.5 text-xs font-extrabold disabled:opacity-50">
        Kick
      </button>
      {error && <span className="text-xs font-extrabold text-[var(--hot)]">{error}</span>}
    </span>
  );
}
