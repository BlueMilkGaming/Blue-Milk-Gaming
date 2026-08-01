# "NEW" Chip on The Tables Nav Item Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small "NEW" sticker-chip next to "The Tables" in the site header whenever the tables are idle, swapping to the existing live dot when a lobby is open or pods are running.

**Architecture:** One render branch inside the existing `TablesNavDot` client component in `website/src/app/tables-live.tsx`. The chip is the default (pre-fetch and idle) state; the blue dot remains the active state. No new components, no copy changes anywhere else.

**Tech Stack:** Next.js 15 App Router, Tailwind v4 arbitrary values with the site's CSS variables (`--hot`, `--ink`, `--accent`).

## Global Constraints

- No em dashes in public-facing copy (chip text is just "New", so this is only a guard for any copy edits).
- Never mention Karabast anywhere.
- `npm run dev` (run in `website/`) wraps `sst shell --stage production`, so it needs AWS credentials in the environment; the dev server writes to `.next-dev`.
- The chip is temporary by design: the spec's removal plan says delete the chip branch a few weeks after launch. The code comment must name that intent.

---

### Task 1: Chip branch in TablesNavDot

**Files:**
- Modify: `website/src/app/tables-live.tsx:28-35` (the `TablesNavDot` function and its doc comment)

**Interfaces:**
- Consumes: `usePodSnapshot(pollMs)` already defined in the same file; returns `HomeSnapshot | null` where `HomeSnapshot = { lobby: { seats: string[]; createdAt: string } | null; playingCount: number }`.
- Produces: `TablesNavDot(): JSX element` — same export name and call site as today (`site-chrome.tsx` line 61 renders it inside the "/play" nav link). No signature change; later tasks and callers are unaffected.

The spec explicitly scopes testing to a visual browser check: this is a render branch with no logic worth a unit test, so there is no test-writing step. Verification is steps 2-4.

- [ ] **Step 1: Replace the component**

Replace the current `TablesNavDot` (the doc comment on line 28 through the closing brace on line 35) with:

```tsx
/**
 * Nav marker for The Tables. While a lobby is open or a pod is running, the
 * Blue Milk dot; otherwise a "NEW" sticker, because pods launched 2026-08-01
 * and nothing like them exists in the community yet. Once the feature is
 * common knowledge (a few weeks post-launch), delete the chip branch and let
 * this go back to being just the dot.
 */
export function TablesNavDot() {
  const snap = usePodSnapshot(60_000);
  if (snap && (snap.lobby || snap.playingCount > 0)) {
    return (
      <span aria-label="tables active" className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-middle" />
    );
  }
  return (
    <span className="ml-1.5 inline-block -rotate-3 bg-[var(--hot)] px-1 py-0.5 align-middle text-[0.5625rem] font-extrabold uppercase leading-none tracking-wide text-[var(--ink)]">
      New
    </span>
  );
}
```

Notes for the implementer:
- The active-state `<span>` is byte-for-byte the dot that exists today; only the surrounding control flow changes (early `return null` becomes the chip fallback).
- The condition is the exact negation of the old guard `!snap || (!snap.lobby && snap.playingCount === 0)`, so active behavior is unchanged.
- The chip styling reuses the flyer tag's vocabulary from `page.tsx` ("This Sunday. All are welcome.": `bg-[var(--hot)]`, `font-extrabold uppercase`): hot pink background, ink text, slight `-rotate-3` sticker tilt.
- Do not touch `usePodSnapshot`, `TablesSection`, or `site-chrome.tsx`.

- [ ] **Step 2: Verify the idle state in the browser**

Start the dev server with the browser preview tooling (launch config named in `.claude/launch.json` if present; otherwise `npm run dev` in `website/`, which needs AWS credentials). Load the home page and `/play`.

Expected: "The Tables" in the header shows a small tilted pink "NEW" chip after the label, on both pages, assuming no lobby is open in production (the dev server reads production tables). The chip should also be visible immediately on load, before the first `/api/pod` poll resolves.

- [ ] **Step 3: Verify the active state**

Production is likely quiet, so force the branch locally: temporarily invert the condition in the file (change `snap.playingCount > 0` to `snap.playingCount >= 0`), reload, and confirm the header shows the small blue dot instead of the chip and that the two never render together. Then revert the temporary change and confirm the chip is back.

Expected: dot only while forced, chip only after revert, never both.

- [ ] **Step 4: Check the console**

With the page open, confirm there are no new console errors or hydration warnings from the header.

Expected: console clean of anything referencing `tables-live` or hydration mismatches.

- [ ] **Step 5: Commit**

```bash
git add website/src/app/tables-live.tsx
git commit -m "nav: NEW chip on The Tables until the dot takes over"
```
