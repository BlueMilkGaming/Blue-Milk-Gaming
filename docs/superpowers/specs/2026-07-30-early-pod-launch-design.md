# Early Pod Launch, Single-Message Announcements, Avatars — Design

Date: 2026-07-30. Status: approved.

## Context

Stage 2 pods launch only when the 8th chair is taken. While the club is
small, 8-player lobbies may rarely fill, so a ready table of 4 sits idle
until it expires. The 8-player format came from the in-person "Premier
Pods" side events, but the tool's real job is helping players find quality
matches; the exact count does not matter.

The Discord webhook currently posts four separate messages per table
lifecycle (opened, 6 of 8, launched, cleared), which risks training the
channel to ignore them, and there is no way to ping the existing `@LFG`
role without spamming it.

## Decisions made during brainstorming

- **Fire at any even count of 4 or 6; 8 still auto-launches.** No odd
  counts (everyone plays every round; no bye machinery). No 5-to-7 dead
  zone.
- **Host-only fire button.** The host is the first seat (`seats[0]`).
  Handoff is free: if the host leaves, the next-oldest seat becomes
  `seats[0]`. An idle host self-heals via the existing 60-minute lobby
  expiry. A fallback timer (anyone can fire after N idle minutes) is
  deliberately deferred to the ramp-up list.
- **Pairing engine untouched.** With 4 players the existing
  rematch-penalty pairing is a round robin by construction: the penalty
  (100) dwarfs any record-mismatch sum, so round 2 avoids the round 1
  pairing and round 3 is forced into the only remaining rematch-free
  matching. With 6 it is ordinary Swiss. No round-robin code needed.
- **Payouts unchanged.** `PODS_V1`: 25 currency per win, best 2 pods per
  club day. Max wins per pod is 3 regardless of size.
- **One Discord message per table, edited in place.** Post once when the
  table opens (`?wait=true` returns the message id; store it on the pod
  row), then PATCH that message on every seat change and on
  launch, abandon/clear, and close (final state: "pod finished"). Edits
  never re-ping. The 1-chair, 6-chair, and
  separate launch/cleared messages are removed. Total channel footprint:
  one message per table, final state visible.
- **@LFG role ping, rate-limited, zero new state.** The opening post
  mentions `<@&LFG_ROLE_ID>` (explicit `allowed_mentions`) so ~100 people
  hear about the table, but only if no pod was created in the last 60
  minutes (checked via the existing `byDay` query). Join/leave/join spam
  creates new lobbies, so only the first in an hour pings; the message
  itself always posts. The role id becomes an SST secret (`LfgRoleId`).
- **Discord avatars in the waiting room.** The `identify` OAuth scope
  already returns the avatar hash; capture it in the JWT callback, store
  it on the `Account` at `ensureAccount` (refreshed each sign-in), copy it
  onto the `Seat` at join, and render
  `https://cdn.discordapp.com/avatars/{id}/{hash}.png?size=64` in the
  lobby seat list. No avatar (null hash) renders an initial-letter
  placeholder. Stale hashes after an avatar change heal at next sign-in.
- **In-pod chat: cut.** Considered (polling piggyback on the existing 7s
  `/api/pod` poll), deliberately dropped for now; Discord covers
  coordination. Revisit if players report friction finding each other.

## Changes by file

### `src/lib/pods.ts` (pure logic)

- New constant `POD_MIN = 4`. `POD_SIZE = 8` remains the lobby capacity.
- New pure guard `fireError(pod, playerId): string | null` in the style of
  `reportError`/`flagError`: pod must be `filling`, caller must be
  `seats[0]`, seat count must be even and `>= POD_MIN`.

### `src/lib/pods-db.ts` (Dynamo I/O)

- `launchPod(pod)` condition changes from `size(seatIds) = POD_SIZE` to
  `size(seatIds) = :n` where `:n` is the seat count from the consistent
  read the caller just performed. The auto-launch path passes 8; the fire
  path passes the count the host saw. A racing join makes the conditional
  write fail cleanly and the fire is a no-op (host sees the fuller lobby
  on the next poll and can fire again).
- New `firePod(playerId, podId)`: consistent read, `fireError` guard, then
  `launchPod` with the exact count.
- `PodRow` gains `announceMessageId?: string` (set on the opening post)
  and `Seat` gains `avatar?: string` (Discord avatar hash).
- Announcement call sites collapse: `joinOrCreate` (create path) posts the
  opening message and stores the id; join/leave/launch/abandon/close all
  edit it. The 6-chair announcement is deleted.
- Ping cooldown: the create path reuses `byDay(clubDay())`; if any pod
  (any status) was created less than 60 minutes ago, post without the role
  mention.

### `src/lib/discord.ts`

- `post` gains a `wait` variant returning the created message id, plus
  `editMessage(webhookUrl, messageId, content)` doing the PATCH. Both stay
  best-effort: a lost message or failed edit never blocks the write it
  follows. A missing `announceMessageId` (opening post failed) simply
  skips edits for that pod's lifetime.
- Mention helper builds `content` with `<@&id>` and
  `allowed_mentions: { roles: [id] }` only when pinging.

### `src/lib/auth.ts` / `src/app/play/actions.ts` / `src/lib/accounts.ts`

- JWT callback captures `profile.avatar` (hash or null) into the token;
  session exposes it.
- `ensureAccount` refreshes `avatar` alongside `displayName` on every
  touch. `AccountRow` gains `avatar?: string`.
- `joinAction` passes the avatar through to `joinOrCreate`, which writes
  it on the seat.

### UI and copy

- `/play` lobby: seat list shows avatars (32px, initial-letter fallback);
  the host row is marked ("host"); when the count is even and `>= 4` the
  host sees a "Launch with N players" button wired to a new `fireAction`.
  Non-hosts see who can launch. "X of 8 chairs" copy becomes 4-to-8
  aware, and "Deals when the 8th chair is taken" is reworded (the table
  deals at 8, or when the host launches with 4 or 6).
- `tables-live.tsx` (home): "Eight chairs, three rounds" becomes
  four-to-eight phrasing; the filling line drops the hardcoded 8.
- All copy follows house rules: no em dashes, no Karabast, spell out Blue
  Milk Gaming.

## Error handling

- Fire races a join: conditional write fails, surfaced as a friendly
  "the table changed, look again" error; lobby state refreshes on poll.
- Fire by a non-host / odd count / under 4: rejected by `fireError`
  server-side; the button is also hidden client-side.
- Webhook post/edit failures: swallowed as today; the site never blocks
  on Discord.

## Testing (`node --test`, existing pattern)

- `dealRound` with 4 players produces a full round robin across 3 rounds
  (every pair meets exactly once) under any rng.
- `dealRound` with 6 players: 3 rounds, no rematches.
- `fireError`: non-host, odd count, count < 4, non-filling status, happy
  path at 4 and 6.
- Ping-cooldown decision extracted as a pure function
  (`shouldPingLfg(podsToday, now)`) and tested.
- Existing Dynamo expression discipline: diff `:tokens` against
  `ExpressionAttributeValues` on every touched expression.

## Out of scope (ramp-up list)

- Fallback fire timer (anyone can launch after N idle minutes).
- In-pod chat.
- Byes for odd counts.
