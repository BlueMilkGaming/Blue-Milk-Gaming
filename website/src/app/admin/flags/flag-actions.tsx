"use client";
import { useState, useTransition } from "react";
import { resolveFlagAction } from "./actions";

export function FlagActions(props: { podId: string; roundIndex: number; matchIndex: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const decide = (decision: "uphold" | "overturn" | "void") =>
    start(async () => {
      setError("");
      const result = await resolveFlagAction(props.podId, props.roundIndex, props.matchIndex, decision);
      if ("error" in result) setError(result.error);
    });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {(["uphold", "overturn", "void"] as const).map((decision) => (
        <button key={decision} onClick={() => decide(decision)} disabled={pending}
          className="cursor-pointer rounded-full border-2 border-[var(--ink)] px-4 py-1.5 text-sm font-extrabold capitalize disabled:opacity-50">
          {decision}
        </button>
      ))}
      {error && <span className="text-sm font-extrabold text-[var(--hot)]">{error}</span>}
    </div>
  );
}
