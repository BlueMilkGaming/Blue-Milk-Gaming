# Pod seat liveness, admin kick, and /admin/pods

Date: 2026-08-02
Status: approved

## Problem

A player who joins a filling lobby and closes the tab (or walks away) holds
the seat until the lobby's TTL expires. Because only the host (seat 1) can
launch early, an absent host with 4-7 seated players wedges the table for
everyone. There is no admin tool to remove a player from a lobby, and no
visibility into pod usage over time.

## What exists today

- `LOBBY_TTL_MS` (60 min): a filling lobby is lazily abandoned by
  `tablesSnapshot()` on every poll, releasing all seats.
- An emptied lobby is abandoned on the spot by `leavePod`.
- `/play` polls `GET /api/pod` every 7 seconds while the tab is open.
- Playing pods already handle absence: the 30-minute no-show claim and the
  4-hour pod TTL.

## Design

### 1. Heartbeat

`Seat` gains optional `lastSeenAt: string`. The `GET /api/pod` handler stamps
the caller's seat when:

- the caller is seated in a **filling** pod, and
- their current stamp (falling back to `joinedAt`) is over 60 seconds old.

The stamp is a conditional `UpdateCommand` on `seats[i].lastSeenAt` requiring
`seats[i].playerId` still equals the caller and status is still `filling`.
On condition failure (seat moved, pod launched) the stamp is skipped; the
next poll retries. Cost: about one write per seated player per minute, only
while a lobby is filling.

Backgrounded tabs still poll (browsers throttle timers to roughly once a
minute but do not stop them), so switching to Discord keeps the seat while a
closed tab or sleeping laptop goes quiet.

### 2. Stale-seat sweep

- New constant `SEAT_STALE_MS = 5 * 60 * 1000` in pods.ts.
- New pure helper `staleSeats(pod, now)`: for a filling pod, the seats whose
  freshest of `lastSeenAt` / `joinedAt` is older than `SEAT_STALE_MS`.
  Empty for non-filling pods.
- `tablesSnapshot()` (already the lazy-expiry hook, runs on every poll)
  additionally stands up every stale seat in every filling lobby.

The seat-removal transaction currently inlined in `leavePod` is extracted
into a shared `removeSeat(pod, playerId)` used by leave, the sweep, and
admin kick. One code path means empty-lobby abandonment, the Discord
announcement edit, and `activePodId` release behave identically everywhere.
Removing seat 1 promotes the next player to host (seats[0]), which unwedges
the absent-host lobby.

Playing pods are untouched.

### 3. Lobby TTL: 60 → 30 minutes

`LOBBY_TTL_MS` drops to 30 minutes. No player waits anywhere near an hour at
a table that never fills; the heartbeat sweep handles departed players, so
the TTL only covers the "nobody else ever showed up" case.

### 4. Admin kick

Server action `kickAction(podId, playerId)` gated by the existing admin
allowlist (same pattern as the flags actions), calling `removeSeat`. Valid
only while the pod is filling. Covers the case the heartbeat cannot see:
tab open, player gone.

### 5. /admin/pods page

Added to the admin nav. Two read sections plus the kick control:

- **Open tables:** current filling and playing pods. Filling pods list each
  seat with joined / last-seen times and a kick button.
- **History:** pods from the last 14 days via the `byDay` index. Per pod:
  date, status, player names, rounds completed, createdAt, closedAt. One
  summary line: total pods, distinct players.

Read-only, no pagination.

## Out of scope

- sendBeacon / pagehide auto-leave: unreliable exactly when needed, and too
  aggressive when it works (briefly closing the tab should not cost a seat;
  rejoin already re-seats via `activePodId`).
- Any change to playing-pod rules (no-show claim covers absence there).
- Showing idle/stale status to players on /play.

## Verification

- `staleSeats` and other pure logic: `node --test` cases in pods.test.ts.
- End to end in production with `scripts/pod-sim.ts`: seat sim players, let
  a heartbeat go quiet, watch the sweep stand the seat up and edit the
  Discord card; kick from /admin/pods; confirm `activePodId` cleanup; check
  the history section renders the day's pods. Clean up test data after.
