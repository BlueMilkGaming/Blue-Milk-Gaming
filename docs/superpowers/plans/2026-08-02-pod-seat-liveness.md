# Pod Seat Liveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free abandoned seats in filling pod lobbies automatically (heartbeat via the existing /play poll, 5-minute stale sweep), cut the lobby TTL to 30 minutes, and add an /admin/pods page with a kick button and a 14-day pod history.

**Architecture:** The /play page already polls `GET /api/pod` every 7 seconds; that poll becomes a heartbeat by stamping `lastSeenAt` on the caller's seat (throttled to once a minute). `tablesSnapshot()`, which already applies lazy TTL expiry on every poll, additionally stands up seats whose heartbeat went quiet for 5 minutes. Seat removal (player leave, sweep, admin kick) all flow through one shared `removeSeat` function extracted from today's `leavePod`. No new tables, no new infra, no sockets.

**Tech Stack:** Next.js 15 App Router, TypeScript, DynamoDB via `@aws-sdk/lib-dynamodb`, SST v4, node:test.

Spec: `docs/superpowers/specs/2026-08-02-pod-seat-liveness-design.md`

## Global Constraints

- All commands run in `website/` unless noted.
- Unit tests: `node --test src/lib/pods.test.ts` (node's built-in runner, no framework). Node runs `.ts` in strip-only mode: no constructor parameter properties, no TS syntax needing real transformation.
- Build check: `npx sst shell --stage production -- npm run build` (a bare `npm run build` dies on "SST links are not active").
- No em dashes in public-facing copy (page text, button labels, error messages shown to users). Code comments exempt.
- Never mention Karabast anywhere.
- Playing pods are untouched: heartbeat, sweep, and kick apply only to `status === "filling"` pods.
- Admin gate: `session.user.isAdmin`, server-side, same as /admin/flags.
- Server actions return `{ error: string } | { ok: true }`; never throw to the client (Next masks thrown messages in production).
- Do not deploy mid-plan; deploy once at Task 6. Check `git status` for other sessions' WIP before deploying.

---

### Task 1: Pure logic — constants, `lastSeenAt`, `staleSeats`

**Files:**
- Modify: `src/lib/pods.ts` (constants at top, `Seat` type, new helper after `effectiveStatus`)
- Test: `src/lib/pods.test.ts`

**Interfaces:**
- Consumes: existing `Seat`, `PodRow` types in `src/lib/pods.ts`.
- Produces: `LOBBY_TTL_MS = 30 min` (value change only), `SEAT_STALE_MS: number`, `HEARTBEAT_MS: number`, `Seat.lastSeenAt?: string`, and `staleSeats(pod: PodRow, now?: Date): Seat[]`. Tasks 3, 4, and 5 rely on these exact names.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/pods.test.ts` (the file already imports `pod(...)` helper and `PodRow`; extend the existing second import block from `./pods.ts` with `staleSeats` and `SEAT_STALE_MS`):

```ts
test("staleSeats flags only quiet seats in a filling pod", () => {
  const now = new Date("2026-08-02T01:00:00Z");
  const old = new Date(now.getTime() - SEAT_STALE_MS - 1).toISOString();
  const p = pod({
    status: "filling",
    seats: [
      { playerId: "p0", displayName: "Fresh join", joinedAt: now.toISOString() },
      { playerId: "p1", displayName: "Quiet", joinedAt: old },
      { playerId: "p2", displayName: "Heartbeat", joinedAt: old, lastSeenAt: now.toISOString() },
      { playerId: "p3", displayName: "Stale heartbeat", joinedAt: old, lastSeenAt: old },
    ],
  });
  assert.deepEqual(staleSeats(p, now).map((s) => s.playerId), ["p1", "p3"]);
});

test("staleSeats ignores non-filling pods", () => {
  const old = new Date(Date.now() - SEAT_STALE_MS - 1).toISOString();
  const p = pod({
    status: "playing",
    seats: [{ playerId: "p0", displayName: "P0", joinedAt: old }],
  });
  assert.deepEqual(staleSeats(p), []);
});
```

Note: the existing `pod()` helper builds a `PodRow` from a `Partial<PodRow>`; check its defaults near line 58 of the test file and pass `seats` explicitly as above.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/lib/pods.test.ts`
Expected: FAIL — `staleSeats` and `SEAT_STALE_MS` are not exported.

- [ ] **Step 3: Implement in `src/lib/pods.ts`**

Change the TTL line (the /play "minutes left" countdown reads this constant, so the UI follows automatically):

```ts
export const LOBBY_TTL_MS = 30 * 60 * 1000;      // filling > 30 min → abandoned
```

Add next to the other constants:

```ts
export const SEAT_STALE_MS = 5 * 60 * 1000;      // no heartbeat for 5 min → stood up
export const HEARTBEAT_MS = 60 * 1000;           // min gap between lastSeenAt stamps
```

Extend the `Seat` type:

```ts
export type Seat = {
  playerId: string;
  displayName: string;
  joinedAt: string;
  avatar?: string | null;
  lastSeenAt?: string; // stamped by the /api/pod poll while the pod is filling
};
```

Add after `effectiveStatus`:

```ts
/** Seats in a filling pod whose heartbeat has gone quiet; readers stand them up lazily. */
export function staleSeats(pod: PodRow, now: Date = new Date()): Seat[] {
  if (pod.status !== "filling") return [];
  return pod.seats.filter(
    (s) => now.getTime() - Date.parse(s.lastSeenAt ?? s.joinedAt) > SEAT_STALE_MS,
  );
}
```

- [ ] **Step 4: Run all lib tests to verify they pass**

Run: `node --test src/lib/pods.test.ts`
Expected: PASS, including the pre-existing TTL tests (they use the constant, not a literal).

- [ ] **Step 5: Commit**

```bash
git add website/src/lib/pods.ts website/src/lib/pods.test.ts
git commit -m "pods: 30-min lobby TTL, seat lastSeenAt, staleSeats helper"
```

---

### Task 2: Generalize `leavePod` into shared `removeSeat`

**Files:**
- Modify: `src/lib/pods-db.ts` (the `leavePod` function, ~lines 262-300)
- Modify: `src/app/play/actions.ts` (the `leaveAction` caller and the import)

**Interfaces:**
- Consumes: nothing new.
- Produces: `removeSeat(podId: string, playerId: string): Promise<void>` exported from `src/lib/pods-db.ts`, replacing `leavePod`. Same CAS transaction, empty-lobby abandonment, Discord edit, and `activePodId` release as today. Tasks 4 and 5 call it. Throws `Error` with a player-readable message on failure.

- [ ] **Step 1: Rename and neutralize `leavePod`**

In `src/lib/pods-db.ts`, replace the `leavePod` declaration and its two error messages so the same wording works for the leaving player, the sweep, and an admin kick. The body is otherwise unchanged:

```ts
/**
 * Stand a player up from a filling lobby. One path for player leave, the
 * stale-seat sweep, and admin kick. CAS on the seat set so a concurrent
 * join is never dropped.
 */
export async function removeSeat(podId: string, playerId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const pod = await getPod(podId);
    if (pod.status !== "filling") throw new Error("The table is no longer filling.");
    if (!pod.seatIds.has(playerId)) throw new Error("Not seated at that table.");
    const seats = pod.seats.filter((s) => s.playerId !== playerId);
    // ... existing transaction, announcement edit, and retry loop unchanged ...
  }
  throw new Error("The table is busy; try again.");
}
```

- [ ] **Step 2: Update the caller**

In `src/app/play/actions.ts`, import `removeSeat` instead of `leavePod` and change `leaveAction`:

```ts
export async function leaveAction(podId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { error: "Sign in first." };
  return run(() => removeSeat(podId, session.user.discordUserId));
}
```

Confirm nothing else references `leavePod`: `grep -rn "leavePod" src/` should return nothing.

- [ ] **Step 3: Verify tests and build**

Run: `node --test src/lib/*.test.ts`
Expected: PASS (pure-logic tests are untouched by this refactor).

Run: `npx sst shell --stage production -- npm run build`
Expected: build succeeds; no type errors from the rename.

- [ ] **Step 4: Commit**

```bash
git add website/src/lib/pods-db.ts website/src/app/play/actions.ts
git commit -m "pods: extract removeSeat as the one seat-removal path"
```

---

### Task 3: Heartbeat stamp on the /api/pod poll

**Files:**
- Modify: `src/lib/pods-db.ts` (new function after `getPod`)
- Modify: `src/app/api/pod/route.ts` (GET handler)

**Interfaces:**
- Consumes: `HEARTBEAT_MS` from Task 1; `PodRow`, `getPod`, `doc`, `POD()` already in pods-db.ts.
- Produces: `touchSeat(pod: PodRow, playerId: string): Promise<void>` exported from `src/lib/pods-db.ts`. Best-effort: never throws, writes at most once per `HEARTBEAT_MS` per seat, only while the pod is filling.

- [ ] **Step 1: Add `touchSeat` to `src/lib/pods-db.ts`**

Add `HEARTBEAT_MS` to the existing import from `./pods.ts`, then:

```ts
/**
 * Best-effort lastSeenAt stamp on the caller's seat, throttled to one write
 * per HEARTBEAT_MS. Condition on the seat index still holding this player:
 * if a leave shifted the list or the pod launched, skip; the next poll retries.
 */
export async function touchSeat(pod: PodRow, playerId: string): Promise<void> {
  if (pod.status !== "filling") return;
  const i = pod.seats.findIndex((s) => s.playerId === playerId);
  if (i < 0) return;
  const seat = pod.seats[i];
  if (Date.now() - Date.parse(seat.lastSeenAt ?? seat.joinedAt) < HEARTBEAT_MS) return;
  await doc.send(new UpdateCommand({
    TableName: POD(),
    Key: { podId: pod.podId },
    UpdateExpression: `SET seats[${i}].lastSeenAt = :now`,
    ConditionExpression: `#s = :filling AND seats[${i}].playerId = :pid`,
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: {
      ":now": new Date().toISOString(), ":filling": "filling", ":pid": playerId,
    },
  })).catch(() => {});
}
```

- [ ] **Step 2: Stamp from the GET handler**

In `src/app/api/pod/route.ts`, import `touchSeat` alongside `tablesSnapshot, getPod`, and inside the `if (session)` block, right after the `if (pod && ...) you = pod;` line:

```ts
    if (you) await touchSeat(you, session.user.discordUserId);
```

(`touchSeat` itself ignores playing pods, so no status check is needed here.)

- [ ] **Step 3: Verify build**

Run: `npx sst shell --stage production -- npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add website/src/lib/pods-db.ts website/src/app/api/pod/route.ts
git commit -m "pods: poll doubles as seat heartbeat (lastSeenAt, 1 write/min)"
```

---

### Task 4: Stale-seat sweep in `tablesSnapshot`

**Files:**
- Modify: `src/lib/pods-db.ts` (`tablesSnapshot`, ~lines 112-122)

**Interfaces:**
- Consumes: `staleSeats` from Task 1, `removeSeat` from Task 2.
- Produces: no new exports. `tablesSnapshot()` keeps its signature; after this task every poll also stands up quiet seats in filling lobbies.

- [ ] **Step 1: Extend `tablesSnapshot`**

Add `staleSeats` to the `./pods.ts` import. Replace the function body so the sweep runs between the existing TTL expiry and the lobby pick, re-querying only when something changed:

```ts
export async function tablesSnapshot(): Promise<{ lobby: PodRow | null; playingCount: number }> {
  let filling = await byStatus("filling");
  const playing = await byStatus("playing");
  const staleLobbies = filling.filter((p) => effectiveStatus(p) === "abandoned");
  const stuckPods = playing.filter((p) => effectiveStatus(p) === "done");
  for (const pod of staleLobbies) await abandonPod(pod);
  for (const pod of stuckPods) await closePod(pod);

  let swept = false;
  for (const pod of filling) {
    if (effectiveStatus(pod) !== "filling") continue;
    for (const seat of staleSeats(pod)) {
      // Busy table (three lost CAS races) just waits for the next poll.
      await removeSeat(pod.podId, seat.playerId).catch(() => {});
      swept = true;
    }
  }
  if (swept) filling = await byStatus("filling");

  const lobbies = filling
    .filter((p) => effectiveStatus(p) === "filling" && p.seats.length > 0)
    .sort((a, b) => (a.podId < b.podId ? -1 : 1));
  return { lobby: lobbies[0] ?? null, playingCount: playing.length - stuckPods.length };
}
```

(Sweeping the last seat flips the pod to abandoned inside `removeSeat`; the re-query plus the `seats.length > 0` filter keeps it out of the lobby pick either way.)

- [ ] **Step 2: Verify tests and build**

Run: `node --test src/lib/*.test.ts`
Expected: PASS.

Run: `npx sst shell --stage production -- npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add website/src/lib/pods-db.ts
git commit -m "pods: sweep quiet seats out of filling lobbies on every poll"
```

---

### Task 5: /admin/pods page with kick and history

**Files:**
- Modify: `src/lib/pods-db.ts` (two small read helpers next to `unresolvedFlags`)
- Create: `src/app/admin/pods/actions.ts`
- Create: `src/app/admin/pods/kick-button.tsx`
- Create: `src/app/admin/pods/page.tsx`
- Modify: `src/app/admin/admin-nav.tsx` (one entry)

**Interfaces:**
- Consumes: `removeSeat` (Task 2); `byStatus`, `byDay` (private in pods-db.ts); `clubDay`, `roundComplete` from pods.ts; `auth`, `AdminNav`, `StoreStyles` patterns from /admin/flags.
- Produces: `openPods(): Promise<{ filling: PodRow[]; playing: PodRow[] }>` and `recentPods(days: string[]): Promise<PodRow[]>` (newest first) exported from pods-db.ts; `kickAction(podId: string, playerId: string): Promise<{ error: string } | { ok: true }>`.

- [ ] **Step 1: Read helpers in `src/lib/pods-db.ts`**

```ts
/** Current tables for /admin/pods. No lazy expiry here; the poll handles that. */
export async function openPods(): Promise<{ filling: PodRow[]; playing: PodRow[] }> {
  const [filling, playing] = await Promise.all([byStatus("filling"), byStatus("playing")]);
  return { filling, playing };
}

/** Every pod on the given days, newest first (podId is a ulid, so id order is time order). */
export async function recentPods(days: string[]): Promise<PodRow[]> {
  const pods = (await Promise.all(days.map(byDay))).flat();
  return pods.sort((a, b) => (a.podId > b.podId ? -1 : 1));
}
```

- [ ] **Step 2: Server action `src/app/admin/pods/actions.ts`**

```ts
"use server";
// Errors travel as return values: Next masks messages thrown from server
// actions in production (same reason resolveFlagAction returns { error }).
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { removeSeat } from "@/lib/pods-db";

export async function kickAction(
  podId: string, playerId: string,
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user.isAdmin) return { error: "admins only" };
  try {
    await removeSeat(podId, playerId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "kick failed" };
  }
  revalidatePath("/admin/pods");
  return { ok: true };
}
```

- [ ] **Step 3: Client component `src/app/admin/pods/kick-button.tsx`**

```tsx
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
```

- [ ] **Step 4: Page `src/app/admin/pods/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { openPods, recentPods } from "@/lib/pods-db";
import { clubDay, roundComplete, type PodRow } from "@/lib/pods";
import { StoreStyles } from "../../store-styles";
import { AdminNav } from "../admin-nav";
import { KickButton } from "./kick-button";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 14;

const at = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Chicago", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : "-";

const names = (pod: PodRow) => pod.seats.map((s) => s.displayName).join(", ");

export default async function PodsPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const days = Array.from({ length: LOOKBACK_DAYS }, (_, i) =>
    clubDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const [{ filling, playing }, history] = await Promise.all([openPods(), recentPods(days)]);
  const distinctPlayers = new Set(history.flatMap((p) => p.seats.map((s) => s.playerId))).size;
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin/pods" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Open tables</h1>
          {filling.length === 0 && playing.length === 0 && (
            <p className="mt-4 font-extrabold">No tables open right now.</p>
          )}
          <ul className="mt-4 space-y-5">
            {filling.map((pod) => (
              <li key={pod.podId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4">
                <p className="font-extrabold">
                  Filling: {pod.seats.length} seated, opened {at(pod.createdAt)}
                </p>
                <ul className="mt-2 space-y-1">
                  {pod.seats.map((s) => (
                    <li key={s.playerId} className="flex items-center gap-3 text-sm font-extrabold">
                      <span>{s.displayName}</span>
                      <span className="text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                        joined {at(s.joinedAt)}, seen {at(s.lastSeenAt ?? s.joinedAt)}
                      </span>
                      <KickButton podId={pod.podId} playerId={s.playerId} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {playing.map((pod) => (
              <li key={pod.podId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4">
                <p className="font-extrabold">Playing: round {pod.rounds.length}</p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {names(pod)}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="tilt-r taped paper mt-8 p-8">
          <h2 className="display text-3xl">Last {LOOKBACK_DAYS} days</h2>
          <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
            {history.length} pods, {distinctPlayers} distinct players.
          </p>
          <ul className="mt-4 space-y-4">
            {history.map((pod) => (
              <li key={pod.podId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-3">
                <p className="font-extrabold">
                  {pod.day}: {pod.status}, {pod.seats.length} players,{" "}
                  {pod.rounds.filter(roundComplete).length} of {pod.rounds.length} rounds reported
                </p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  {names(pod) || "nobody seated"}. Opened {at(pod.createdAt)}, closed {at(pod.closedAt)}.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Nav entry**

In `src/app/admin/admin-nav.tsx`, add to `PAGES` after Flags:

```ts
  { label: "Pods", href: "/admin/pods" },
```

- [ ] **Step 6: Verify build**

Run: `npx sst shell --stage production -- npm run build`
Expected: build succeeds and the route list includes `/admin/pods`.

- [ ] **Step 7: Commit**

```bash
git add website/src/lib/pods-db.ts website/src/app/admin/pods website/src/app/admin/admin-nav.tsx
git commit -m "admin: /admin/pods with seat kick and 14-day pod history"
```

---

### Task 6: Deploy and verify in production

**Files:**
- Modify: `CLAUDE.md` (status paragraph, after verification)

No new SST resources or secrets are added, so the "first deploy fails on sst-env.d.ts" gotcha does not apply.

- [ ] **Step 1: Pre-deploy checks**

```bash
git status
```
Expected: clean apart from this plan's commits; no other session's WIP. Stop any running dev server.

- [ ] **Step 2: Deploy**

```bash
cd website && npx sst deploy --stage production > /tmp/deploy.log 2>&1; echo "exit: $?"
```
Expected: `exit: 0`. Never pipe the deploy into tail/grep (masks failures); read `/tmp/deploy.log` if nonzero.

- [ ] **Step 3: Verify heartbeat and sweep with a sim player**

All from `website/`:

```bash
npx sst shell --stage production -- node scripts/pod-sim.ts join 1
```

Sim players never poll, so the seat's `joinedAt` is its only freshness signal.

1. Open https://bluemilkgaming.com/admin/pods as an admin: the filling pod shows sim-player-1 with joined and seen times.
2. Sign in on /play in a browser tab and join the pod; confirm on /admin/pods after ~1 minute that your own seat's "seen" time updates while the tab polls (heartbeat working).
3. Leave via the /play stand-up button (confirms `removeSeat` still serves the player path).
4. Wait 5+ minutes without touching the sim seat, then load /play (any poll triggers the sweep). Expected: sim seat gone; if it was the last seat, the pod is abandoned and the Discord card reads "The table was cleared."

- [ ] **Step 4: Verify admin kick**

```bash
npx sst shell --stage production -- node scripts/pod-sim.ts join 2
```

On /admin/pods, kick one sim player. Expected: seat count drops, Discord card edits to the lower count, and the kicked sim's `activePodId` is cleared (rejoin works: `join 1` seats them again). Kick the rest to empty the pod and confirm it flips to abandoned.

- [ ] **Step 5: Verify the 30-minute TTL copy**

On /play with a fresh lobby, the countdown starts from 30 minutes, not 60.

- [ ] **Step 6: Clean up test data**

```bash
npx sst shell --stage production -- node scripts/pod-sim.ts cleanup <yourDiscordId>
```

Confirm /admin/pods history no longer shows the sim pods.

- [ ] **Step 7: Update CLAUDE.md status and commit**

Add one line to the CLAUDE.md status section noting: seat liveness shipped (heartbeat via poll, 5-min stale sweep, 30-min lobby TTL, /admin/pods with kick and 14-day history), verified in production with the date.

```bash
git add CLAUDE.md
git commit -m "docs: seat liveness + /admin/pods shipped and verified"
```
