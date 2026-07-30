# Early Pod Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the host launch a pod at 4 or 6 players, collapse Discord announcements to one edited-in-place message per table with a rate-limited @LFG ping, and show Discord avatars in the waiting room.

**Architecture:** Pure guards and the ping-cooldown decision go in `src/lib/pods.ts` (unit-tested); Dynamo and webhook I/O changes go in `src/lib/pods-db.ts` and `src/lib/discord.ts`; avatar plumbing rides the existing JWT → `ensureAccount` → `Seat` path. The pairing engine is untouched: with 4 players the existing rematch penalty already produces a round robin.

**Tech Stack:** Next.js 15 App Router, SST v4, DynamoDB (document client, conditional writes), Auth.js v5 Discord, node:test.

Spec: `docs/superpowers/specs/2026-07-30-early-pod-launch-design.md`.

## Global Constraints

- No em dashes in public-facing copy; no "Karabast" anywhere; spell out "Blue Milk Gaming".
- Tests run with `node --test src/lib/pods.test.ts` (strip-only TS: no constructor parameter properties).
- Discord I/O is best effort: a lost post or failed edit never blocks the Dynamo write it follows.
- Diff every touched Dynamo expression's `:tokens` against its `ExpressionAttributeValues` (this has bitten twice).
- `POD_SIZE = 8` stays the lobby capacity everywhere; 4/6 are launch points, not capacities.
- The working tree may hold another session's WIP. Commit only files this plan touches, and check `git status` before any deploy; defer the deploy if unrelated WIP would ship (see final task).
- LFG role id (value for the `LfgRoleId` secret): `1395816476153479168`.

---

### Task 1: Pure logic — `POD_MIN`, `fireError`, `shouldPingLfg`, pairing proofs

**Files:**
- Modify: `website/src/lib/pods.ts`
- Test: `website/src/lib/pods.test.ts`

**Interfaces:**
- Consumes: existing `dealRound`, `PodRow`, `Seat` from `pods.ts`.
- Produces: `POD_MIN: 4`, `LFG_PING_COOLDOWN_MS: number`, `fireError(pod: PodRow, playerId: string): string | null`, `shouldPingLfg(todaysPods: { createdAt: string }[], now?: Date): boolean`. Task 3 calls `fireError` and `shouldPingLfg`.

- [ ] **Step 1: Write the failing tests** (append to `pods.test.ts`; `seats`, `round`, `key`, `pod` helpers already exist at the top of the file)

```ts
import { POD_MIN, fireError, shouldPingLfg, LFG_PING_COOLDOWN_MS } from "./pods.ts";

test("4 players deal a full round robin across three rounds", () => {
  const four = seats.slice(0, 4);
  for (const rng of [() => 0, () => 0.5, () => 0.999]) {
    const rounds: Round[] = [];
    for (let i = 0; i < 3; i++) {
      // Winner choice must not matter: always report the first-listed player.
      const pairings = dealRound(four, rounds, rng).map((m) => ({ ...m, winner: m.a }));
      rounds.push({ pairings, dealtAt: "2026-07-30T00:00:00Z" });
    }
    const met = new Set(rounds.flatMap((r) => r.pairings.map(key)));
    assert.equal(met.size, 6, "every pair meets exactly once (C(4,2) = 6)");
  }
});

test("6 players get three rounds with no rematches", () => {
  const six = seats.slice(0, 6);
  const rounds: Round[] = [];
  for (let i = 0; i < 3; i++) {
    const pairings = dealRound(six, rounds, () => 0.3).map((m) => ({ ...m, winner: m.b }));
    rounds.push({ pairings, dealtAt: "2026-07-30T00:00:00Z" });
  }
  const met = rounds.flatMap((r) => r.pairings.map(key));
  assert.equal(new Set(met).size, 9, "3 rounds x 3 matches, all distinct");
});

test("fireError: host only, even count of at least four, filling only", () => {
  const lobby = (n: number) => pod({ status: "filling", seats: seats.slice(0, n), seatIds: new Set(ids.slice(0, n)) });
  assert.equal(fireError(lobby(4), "p0"), null);
  assert.equal(fireError(lobby(6), "p0"), null);
  assert.match(fireError(lobby(4), "p1")!, /host/i);
  assert.match(fireError(lobby(3), "p0")!, /at least/i);
  assert.match(fireError(lobby(5), "p0")!, /even/i);
  assert.match(fireError(pod({ status: "playing" }), "p0")!, /not filling/i);
});

test("shouldPingLfg: pings when the last table is an hour old, or there is none", () => {
  const now = new Date("2026-07-30T02:00:00Z");
  const at = (msAgo: number) => ({ createdAt: new Date(now.getTime() - msAgo).toISOString() });
  assert.equal(shouldPingLfg([], now), true);
  assert.equal(shouldPingLfg([at(LFG_PING_COOLDOWN_MS + 1)], now), true);
  assert.equal(shouldPingLfg([at(LFG_PING_COOLDOWN_MS - 1)], now), false);
  assert.equal(shouldPingLfg([at(LFG_PING_COOLDOWN_MS + 1), at(60_000)], now), false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd website && node --test src/lib/pods.test.ts`
Expected: the four new tests FAIL (`fireError` etc. not exported); all existing tests still PASS.

- [ ] **Step 3: Implement in `pods.ts`**

Add below the existing constants (`POD_SIZE`, `POD_ROUNDS`, ...):

```ts
export const POD_MIN = 4;
export const LFG_PING_COOLDOWN_MS = 60 * 60 * 1000; // one @LFG ping per hour
```

Add below `flagError`, matching its guard style:

```ts
/** Why this early launch is not allowed, or null if it is. Pure; caller supplies state. */
export function fireError(pod: PodRow, playerId: string): string | null {
  if (pod.status !== "filling") return "This table is not filling.";
  if (pod.seats[0]?.playerId !== playerId) return "Only the host can launch the pod early.";
  const seated = pod.seats.length;
  if (seated < POD_MIN) return `A pod needs at least ${POD_MIN} players.`;
  if (seated % 2 !== 0) return "A pod needs an even number of players.";
  return null;
}

/**
 * Ping @LFG only for the first table of the hour. Join/leave/join spam
 * creates fresh pods, so recent creations (any status) suppress the ping.
 * ponytail: byDay scoping means a 23:50 pod never suppresses a 00:10 ping
 * across club midnight; harmless at this scale.
 */
export function shouldPingLfg(
  todaysPods: { createdAt: string }[],
  now: Date = new Date(),
): boolean {
  return todaysPods.every(
    (p) => now.getTime() - Date.parse(p.createdAt) >= LFG_PING_COOLDOWN_MS,
  );
}
```

Also extend the two row types (used by later tasks; harmless now):

```ts
export type Seat = { playerId: string; displayName: string; joinedAt: string; avatar?: string | null };
```

and add to `PodRow`:

```ts
  announceMessageId?: string; // Discord message edited across the pod's lifetime
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd website && node --test src/lib/pods.test.ts`
Expected: ALL tests PASS.

- [ ] **Step 5: Commit**

```bash
git add website/src/lib/pods.ts website/src/lib/pods.test.ts
git commit -m "feat: pure guards for early pod launch and LFG ping cooldown"
```

---

### Task 2: Discord webhook helpers — post-and-wait, edit in place

**Files:**
- Modify: `website/src/lib/discord.ts`

**Interfaces:**
- Produces: `announceWait(content: string, opts?: { pingRoleId?: string }): Promise<string | null>` (returns the Discord message id, or null on any failure) and `editAnnouncement(messageId: string | undefined, content: string): Promise<void>`. Task 3 consumes both. `announceAdmin` is unchanged; the old `announce` is deleted in Task 3 once its last caller goes.

No unit tests: these are best-effort fetch wrappers with no branching logic beyond the mention body, and the project deliberately does not mock HTTP.

- [ ] **Step 1: Implement**

Add to `discord.ts` (keep the existing `post` and `announceAdmin` untouched for now):

```ts
/**
 * Post to the pods webhook and return the created message id, so the pod
 * can edit this one message for its whole lifetime. Best effort: any
 * failure returns null and the pod simply has no editable message.
 */
export async function announceWait(
  content: string,
  opts: { pingRoleId?: string } = {},
): Promise<string | null> {
  try {
    const body = opts.pingRoleId
      ? {
          content: `<@&${opts.pingRoleId}>\n${content}`,
          allowed_mentions: { roles: [opts.pingRoleId] },
        }
      : { content };
    const res = await fetch(`${Resource.PodsWebhookUrl.value}?wait=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

/** Edit the pod's message in place. Edits never re-ping mentions. */
export async function editAnnouncement(
  messageId: string | undefined,
  content: string,
): Promise<void> {
  if (!messageId) return;
  try {
    await fetch(`${Resource.PodsWebhookUrl.value}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallowed: a stale Discord card never blocks the write it follows.
  }
}
```

- [ ] **Step 2: Verify it typechecks** (tests don't import this file)

Run: `cd website && npx tsc --noEmit`
Expected: no NEW errors in `discord.ts`. (Pre-existing errors elsewhere, if another session's WIP is in the tree, are not yours to fix.)

- [ ] **Step 3: Commit**

```bash
git add website/src/lib/discord.ts
git commit -m "feat: webhook post-and-wait and edit-in-place helpers"
```

---

### Task 3: Pod I/O — exact-count launch, `firePod`, single edited message

**Files:**
- Modify: `website/src/lib/pods-db.ts`
- Modify: `website/src/lib/discord.ts` (delete `announce` and `post`'s now-unused caller path)

**Interfaces:**
- Consumes: `fireError`, `shouldPingLfg`, `POD_MIN` (Task 1); `announceWait`, `editAnnouncement` (Task 2); `Resource.LfgRoleId.value` (Task 4 adds the secret; see the note in Step 5).
- Produces: `firePod(playerId: string, podId: string): Promise<void>` (throws on invalid fire); `joinOrCreate(playerId: string, displayName: string, avatar?: string | null)` grows the third parameter. Task 6 consumes both from server actions.

No new unit tests: every branch worth testing is already pure and tested in Task 1; this task is Dynamo/webhook wiring, verified end to end in the final task.

- [ ] **Step 1: Message builders**

In `pods-db.ts`, replace the `seatBar` comment block area (keep `seatBar` itself) and add, importing `shouldPingLfg` and `POD_MIN` from `./pods.ts` and replacing the `announce` import with `announceWait, editAnnouncement`:

```ts
function fillingMessage(taken: number): string {
  return `${seatBar(taken)}\nA table is filling at Blue Milk Gaming: ${taken} of ${POD_SIZE} chairs taken. The host can launch with ${POD_MIN} or 6; a full table of ${POD_SIZE} deals itself: ${SITE_URL}/play`;
}
function launchedMessage(players: number): string {
  return `${"🟩".repeat(players)}\nPod launched with ${players} players at Blue Milk Gaming. Three rounds: coordinate in Discord, report on the site.`;
}
function finishedMessage(players: number): string {
  return `${"🟩".repeat(players)}\nPod finished at Blue Milk Gaming: ${players} players, three rounds in the books. Next table: ${SITE_URL}/play`;
}
function clearedMessage(): string {
  return `${seatBar(0)}\nThe table was cleared. The next one opens when someone sits down: ${SITE_URL}/play`;
}
```

- [ ] **Step 2: `joinOrCreate` — avatar param, edit-on-join, opening post**

Signature becomes:

```ts
export async function joinOrCreate(
  playerId: string,
  displayName: string,
  avatar: string | null = null,
): Promise<PodRow> {
```

and the seat construction becomes:

```ts
  const seat: Seat = { playerId, displayName, joinedAt: now, avatar };
```

In the join loop, replace the post-join block (currently `if (joined.seats.length >= POD_SIZE) ... else if (... POD_SIZE - 2) await announce(...)`) with:

```ts
      const joined = await getPod(lobby.podId, { consistent: true });
      if (joined.seats.length >= POD_SIZE) await launchPod(joined);
      else await editAnnouncement(joined.announceMessageId, fillingMessage(joined.seats.length));
      return getPod(lobby.podId);
```

In the create path, compute the ping decision BEFORE the Put (so the new pod itself cannot suppress it), then post and store the message id best-effort. Replace the block from `const pod: PodRow = {` through `return pod;` with:

```ts
  const ping = shouldPingLfg(await byDay(clubDay()));
  const pod: PodRow = {
    podId: ulid(), status: "filling", day: clubDay(),
    seats: [seat], seatIds: new Set([playerId]), rounds: [], createdAt: now,
  };
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: POD(), Item: pod, ConditionExpression: "attribute_not_exists(podId)" } },
      claimActiveSeat(playerId, pod.podId),
    ]}));
    const messageId = await announceWait(
      fillingMessage(1),
      ping ? { pingRoleId: Resource.LfgRoleId.value } : {},
    );
    if (messageId) {
      pod.announceMessageId = messageId;
      // Best effort: if this write is lost the pod just has no editable card.
      await doc.send(new UpdateCommand({
        TableName: POD(), Key: { podId: pod.podId },
        UpdateExpression: "SET announceMessageId = :m",
        ExpressionAttributeValues: { ":m": messageId },
      })).catch(() => {});
    }
    return pod;
```

(the existing `catch` fallthrough for the concurrent-join race stays as is).

- [ ] **Step 3: `launchPod` exact count + `firePod`**

Replace `launchPod` with (note `:cap` becomes `:n`, the count actually being dealt, and it now reports whether it won the race):

```ts
/** Flip filling → playing and deal round 1. Condition on the exact seat count
 * the caller read, so a racing join fails the launch cleanly. Any caller may
 * race; one wins. Returns whether this call did the launch. */
async function launchPod(pod: PodRow): Promise<boolean> {
  const players = pod.seats.length;
  const now = new Date().toISOString();
  try {
    await doc.send(new UpdateCommand({
      TableName: POD(),
      Key: { podId: pod.podId },
      UpdateExpression: "SET #s = :playing, filledAt = :now, rounds = :r1",
      ConditionExpression: "#s = :filling AND size(seatIds) = :n",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":playing": "playing", ":filling": "filling", ":now": now, ":n": players,
        ":r1": [{ pairings: dealRound(pod.seats, []), dealtAt: now }],
      },
    }));
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    return false; // another caller dealt it, or the seats changed underneath
  }
  await editAnnouncement(pod.announceMessageId, launchedMessage(players));
  return true;
}

/** The host launches early with 4 or 6 seated. */
export async function firePod(playerId: string, podId: string): Promise<void> {
  // Consistent: firing on a stale seat list would deal the wrong table.
  const pod = await getPod(podId, { consistent: true });
  const error = fireError(pod, playerId);
  if (error) throw new Error(error);
  if (!(await launchPod(pod)))
    throw new Error("The table changed as you launched; look again.");
}
```

(`fireError` comes from `./pods.ts`; add it to the import list.)

- [ ] **Step 4: leave / abandon / close edit the one message**

In `leavePod`, replace the `if (seats.length === 0) await announce(...)` line with:

```ts
      await editAnnouncement(
        pod.announceMessageId,
        seats.length === 0 ? clearedMessage() : fillingMessage(seats.length),
      );
```

In `abandonPod`, replace the final `await announce(...)` line with:

```ts
  await editAnnouncement(pod.announceMessageId, clearedMessage());
```

In `closePod`, the transaction's `catch` currently swallows the double-close race; make the loser skip the edit by adding `return` there, then edit after:

```ts
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (!isConditionFailure(err)) throw err;
    return; // another closer already paid (and edited)
  }
  await editAnnouncement(pod.announceMessageId, finishedMessage(pod.seats.length));
```

- [ ] **Step 5: Delete the dead `announce`**

`announce` in `discord.ts` now has zero callers (verify: `grep -rn "announce(" website/src --include='*.ts' --include='*.tsx' | grep -v announceAdmin | grep -v announceWait`). Delete `announce` and fold `post` into `announceAdmin` (it is now the only caller):

```ts
/** Best effort by design: a lost Discord message never blocks the write it follows. */
export async function announceAdmin(content: string): Promise<void> {
  try {
    await fetch(Resource.AdminWebhookUrl.value, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallowed: announcing is never worth failing the write it follows.
  }
}
```

- [ ] **Step 6: Verify**

Run: `cd website && node --test src/lib/pods.test.ts && npx tsc --noEmit`
Expected: tests PASS. `tsc` will report `Property 'LfgRoleId' does not exist on type 'Resource'` until Task 4's deploy regenerates `sst-env.d.ts` — that ONE error is expected here; anything else in the touched files is a real bug. Diff every `:token` in the edited expressions against its `ExpressionAttributeValues` (`:n` replaced `:cap` in `launchPod`; the join transact still uses `:cap` for the capacity of 8 — confirm each expression is self-consistent).

- [ ] **Step 7: Commit**

```bash
git add website/src/lib/pods-db.ts website/src/lib/discord.ts
git commit -m "feat: host fire at 4/6, single edited Discord message per pod"
```

---

### Task 4: `LfgRoleId` secret

**Files:**
- Modify: `website/sst.config.ts`

**Interfaces:**
- Produces: `Resource.LfgRoleId.value` (consumed by Task 3's code, already written).

- [ ] **Step 1: Set the secret value** (safe before the resource exists)

```bash
cd website && npx sst secret set LfgRoleId "1395816476153479168" --stage production
```

- [ ] **Step 2: Declare and link**

In `sst.config.ts`, next to the other webhook secrets (around line 85):

```ts
    const lfgRoleId = new sst.Secret("LfgRoleId");
```

and add `lfgRoleId,` to the `link:` array of `new sst.aws.Nextjs("Web", ...)` (after `adminWebhookUrl,`).

- [ ] **Step 3: Commit** (config only; the deploy happens in the final task)

```bash
git add website/sst.config.ts
git commit -m "feat: LfgRoleId secret for the @LFG table ping"
```

---

### Task 5: Avatar plumbing — JWT → session → account → seat

**Files:**
- Modify: `website/src/lib/auth.ts`
- Modify: `website/src/lib/accounts.ts`
- Modify: `website/src/app/play/actions.ts` (joinAction only)
- Modify: `website/src/app/account/page.tsx:49`

**Interfaces:**
- Consumes: `joinOrCreate(playerId, displayName, avatar)` from Task 3.
- Produces: `session.user.avatar: string | null` (Discord avatar hash); `ensureAccount(discordUserId, displayName, avatar?: string | null)`. Task 6's UI renders `Seat.avatar`.

- [ ] **Step 1: `auth.ts` — capture the hash**

The `identify` scope already returns `profile.avatar`. Update the module augmentation and both callbacks:

```ts
declare module "next-auth" {
  interface Session {
    user: { discordUserId: string; name: string; avatar: string | null; isAdmin: boolean };
  }
}
```

```ts
    jwt({ token, profile }) {
      if (profile) {
        token.discordUserId = String(profile.id);
        token.name = String(profile.global_name ?? profile.username);
        token.avatar = profile.avatar ? String(profile.avatar) : null;
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        discordUserId: token.discordUserId as string,
        name: token.name as string,
        avatar: (token.avatar as string | null) ?? null,
        isAdmin: parseAdminIds(Resource.AdminDiscordIds.value).has(
          token.discordUserId as string,
        ),
      } as typeof session.user;
      return session;
    },
```

- [ ] **Step 2: `accounts.ts` — store it on every touch**

`AccountRow` gains `avatar?: string | null;` (below `displayName`). `ensureAccount` becomes:

```ts
export async function ensureAccount(
  discordUserId: string,
  displayName: string,
  avatar: string | null = null,
): Promise<AccountRow> {
  const res = await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    // Refresh Discord display name and avatar on every touch; set createdAt once.
    UpdateExpression:
      "SET displayName = :n, avatar = :a, createdAt = if_not_exists(createdAt, :now)",
    ExpressionAttributeValues: { ":n": displayName, ":a": avatar, ":now": new Date().toISOString() },
    ReturnValues: "ALL_NEW",
  }));
  return res.Attributes as AccountRow;
}
```

- [ ] **Step 3: Callers pass it through**

`play/actions.ts` `joinAction` body:

```ts
    await ensureAccount(session.user.discordUserId, session.user.name, session.user.avatar);
    await joinOrCreate(session.user.discordUserId, session.user.name, session.user.avatar);
```

`account/page.tsx:49`: `ensureAccount(discordUserId, name)` → `ensureAccount(discordUserId, name, session.user.avatar)` (the surrounding code already holds the session; match however the file destructures it).

- [ ] **Step 4: Verify**

Run: `cd website && npx tsc --noEmit`
Expected: only the known `LfgRoleId` sst-env error remains (cleared by the final task's deploy).

- [ ] **Step 5: Commit**

```bash
git add website/src/lib/auth.ts website/src/lib/accounts.ts website/src/app/play/actions.ts website/src/app/account/page.tsx
git commit -m "feat: carry the Discord avatar hash from sign-in to the seat"
```

---

### Task 6: `/play` UI — fire button, avatars, host marker, copy

**Files:**
- Modify: `website/src/app/play/actions.ts` (add `fireAction`)
- Modify: `website/src/app/play/play-client.tsx`

**Interfaces:**
- Consumes: `firePod` (Task 3), `Seat.avatar` (Tasks 1/5), `POD_MIN` (Task 1).

- [ ] **Step 1: `fireAction`** (append to `actions.ts`, matching the others; add `firePod` to the pods-db import)

```ts
export async function fireAction(podId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { error: "Sign in first." };
  return run(() => firePod(session.user.discordUserId, podId));
}
```

- [ ] **Step 2: Lobby component**

In `play-client.tsx`, import `fireAction` and `POD_MIN` (add to the existing `@/lib/pods` import; also import `type Seat`). Wire the fire handler where `Lobby` is rendered:

```tsx
      {you?.status === "filling" && <Lobby pod={you} yourId={snap.yourId!}
        onLeave={() => act(() => leaveAction(you.podId))}
        onFire={() => act(() => fireAction(you.podId))}
        pending={pending} />}
```

Replace `Lobby` with:

```tsx
function SeatAvatar({ seat }: { seat: Seat }) {
  if (!seat.avatar) {
    return (
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-extrabold text-[var(--ink)]">
        {seat.displayName.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images.unoptimized is set; Discord CDN serves the sized file
    <img src={`https://cdn.discordapp.com/avatars/${seat.playerId}/${seat.avatar}.png?size=64`}
      alt="" className="h-8 w-8 shrink-0 rounded-full" />
  );
}

function Lobby({ pod, yourId, onLeave, onFire, pending }: {
  pod: NonNullable<Snapshot["you"]>; yourId: string;
  onLeave: () => void; onFire: () => void; pending: boolean;
}) {
  const minutesLeft = Math.max(0, Math.ceil((Date.parse(pod.createdAt) + LOBBY_TTL_MS - Date.now()) / 60000));
  const host = pod.seats[0];
  const isHost = host?.playerId === yourId;
  const canFire = pod.seats.length >= POD_MIN && pod.seats.length % 2 === 0;
  return (
    <div className="tilt-l taped paper p-8">
      <h1 className="display text-4xl">Filling: {pod.seats.length} of 8</h1>
      <ul className="nums mt-5 grid grid-cols-2 gap-2">
        {pod.seats.map((s) => (
          <li key={s.playerId} className="flex items-center gap-2.5 border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2 font-extrabold">
            <SeatAvatar seat={s} />
            <span>
              {s.displayName}
              {s.playerId === yourId && " (you)"}
              {s.playerId === host?.playerId && " (host)"}
            </span>
          </li>
        ))}
        {Array.from({ length: 8 - pod.seats.length }, (_, i) => (
          <li key={`empty-${i}`} className="border-b-2 border-dashed border-[color-mix(in_srgb,var(--ink)_15%,transparent)] py-2 font-extrabold text-[color-mix(in_srgb,var(--ink)_35%,transparent)]">
            open chair
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
        The table clears in {minutesLeft} min if it doesn&apos;t fill. A full 8
        deals itself, or the host can launch with 4 or 6.
      </p>
      {canFire && isHost && (
        <button onClick={onFire} disabled={pending}
          className="mt-5 cursor-pointer rounded-full bg-[var(--hot)] px-6 py-2.5 font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:opacity-50">
          Launch with {pod.seats.length} players
        </button>
      )}
      {canFire && !isHost && (
        <p className="mt-4 text-sm font-extrabold">
          {host.displayName} can launch the pod now, or you can wait for more players.
        </p>
      )}
      <button onClick={onLeave} disabled={pending}
        className="mt-5 ml-0 block cursor-pointer text-sm font-extrabold underline transition-colors hover:text-[var(--accent)]">
        Stand up
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `PlayNow` copy** (same file)

Replace the lobby line:

```tsx
        {snap.lobby
          ? `A table is filling: ${snap.lobby.seats.length} of 8 chairs taken. A full 8 deals itself; the host can launch with 4 or 6.`
          : "Tables are quiet right now. First pod of the day opens when you sit down."}
```

- [ ] **Step 4: Verify in the browser**

Stop any running production build first (build clobbers dev, per CLAUDE.md). Start the dev server (`preview_start` with the launch.json entry for `npm run dev` in `website/`; needs AWS credentials). On `/play`, signed in: join a table, confirm your avatar (or initial) renders, "(you) (host)" marks your seat, and the fire button is absent below 4 seats. `read_console_messages` for errors. Screenshot for the record.

- [ ] **Step 5: Commit**

```bash
git add website/src/app/play/actions.ts website/src/app/play/play-client.tsx
git commit -m "feat: waiting-room avatars, host marker, launch button at 4/6"
```

---

### Task 7: Home page copy

**Files:**
- Modify: `website/src/app/tables-live.tsx:46-48`

- [ ] **Step 1: Reword** (the 8-slot bar stays; 8 is still the capacity)

```tsx
      <p className="mt-3 max-w-md text-[color-mix(in_srgb,var(--paper)_65%,transparent)]">
        Four to eight chairs, three rounds, points for every win. Open whenever
        enough of us are around.
      </p>
```

- [ ] **Step 2: Commit**

```bash
git add website/src/app/tables-live.tsx
git commit -m "copy: home Tables section reflects 4-to-8 pods"
```

---

### Task 8: Build, deploy, verify end to end

- [ ] **Step 1: Unit tests and local build**

```bash
cd website && node --test src/lib/*.test.ts
```

Expected: all pass. Then (dev server stopped first):

```bash
cd website && npx sst shell --stage production -- npm run build > /tmp/build.log 2>&1; echo $?
```

Expected: `LfgRoleId` type error is still possible pre-deploy; if that is the ONLY error, proceed (the deploy regenerates `sst-env.d.ts`).

- [ ] **Step 2: Check for other sessions' WIP**

Run `git status --short`. If files outside this plan's list are modified (at plan-writing time: `page.tsx`, `prizes/page.tsx`, `site-chrome.tsx`, `standings/page.tsx`, `org.ts`, `accounts.ts`, `pods-db.ts`, `pods.ts` had WIP), STOP and ask the user before deploying: a deploy ships the whole tree.

- [ ] **Step 3: Deploy** (never pipe into tail/grep; expect one failure for the new linked secret, then re-run)

```bash
cd website && npx sst deploy --stage production > /tmp/deploy.log 2>&1; echo $?
```

If it fails with `Property 'LfgRoleId' does not exist`, re-run the same command (documented recurring gotcha). Confirm exit 0 in the echo, not the log tail.

- [ ] **Step 4: Verify in production** (solo + `scripts/pod-sim.ts` for synthetic opponents, as in Stage 2)

- Open a table on `/play`: exactly ONE Discord message appears, with the @LFG ping.
- Sim two joins (3 seated): the SAME message updates its seat bar; no new messages; no fire button (odd).
- Sim a fourth join: fire button appears for the host only; fire it.
- Confirm round 1 deals 2 matches; report all 3 rounds via sim; confirm no pair ever meets twice (round robin) and the message ends at "Pod finished".
- Confirm payout: wins × 25 in `/account`, best-2 cap intact.
- Open a second table within the hour: message posts WITHOUT the ping.
- Avatars visible in the waiting room (sim players fall back to initials).
- Clean up test pods/ledger rows as in Stage 2's verification.

- [ ] **Step 5: Update `CLAUDE.md` status + commit**

Add to the Stage 2 paragraph in the project `CLAUDE.md`: hosts can launch at 4 or 6 (round robin at 4 comes free from rematch avoidance), one edited Discord message per table, @LFG ping rate-limited to one per hour, avatars on seats. Commit:

```bash
git add CLAUDE.md
git commit -m "docs: record early pod launch shipping"
```
