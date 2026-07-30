# Prize Wall Redemption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players spend their tournament and pod points on the prize wall; requests land in an admin queue with a Discord ping; admins manage stock and fulfil or cancel.

**Architecture:** Two new Dynamo tables (`Prize`, `Redemption`) plus a race-safe `TransactWriteItems` redemption (ADR 0004). Tournament currency reaches the Discord-keyed `PlayerBalance` via idempotent per-tournament reconciliation (`plc-<meleeId>` deterministic ledger entryIds, conditional puts) run at claim approval, weekly sync, and a one-time launch script. Catalog stays in `src/data/prize-wall.ts` (git is the CMS); Dynamo holds only stock/hidden state.

**Tech Stack:** Next.js 15 App Router, SST v4, DynamoDB (`@aws-sdk/lib-dynamodb`), Auth.js v5, node built-in test runner. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-30-prize-wall-redemption-design.md`

## Global Constraints

- All commands run in `website/` unless noted.
- No new npm dependencies. Do not change pinned `next`/`sst` versions.
- No em dashes in user-facing copy (pages AND Discord messages). Commas, periods, colons instead. Code comments are exempt.
- Never mention Karabast anywhere.
- No PII: never store or render more than Discord display names and melee display names. No shipping addresses.
- Files in `src/lib` and `scripts` use **relative imports with explicit `.ts` extensions** (node strip-only mode); `src/app` files may use the `@/` alias. No TypeScript needing real transformation in files node runs (e.g. no constructor parameter properties).
- Every admin mutation goes through a server-side `isAdmin` gate, not just page hiding.
- Dozens-scale scans are fine; mark deliberate ceilings with a `ponytail:` comment naming the upgrade path.
- Unit tests: `node --test src/lib/*.test.ts` (plain node, NOT sst shell — so tests may only exercise pure functions that never touch `Resource.*`).
- Typecheck after each task: `npx tsc --noEmit`.
- Commit messages: plain imperative mood (repo style, no `feat:` prefixes), ending with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Infrastructure (tables, secret, links, deploy)

**Files:**
- Modify: `website/sst.config.ts`
- Modify: `docs/setup.md` (secrets list)

**Interfaces:**
- Produces: linked resources `Resource.Prize.name`, `Resource.Redemption.name`, `Resource.AdminWebhookUrl.value` for later tasks; the deploy regenerates `sst-env.d.ts` so those names typecheck.

- [ ] **Step 1: Add the tables to `sst.config.ts`**

After the `playerBalance` table definition, add:

```ts
    // Prize wall (redemption spec 2026-07-30). Prize rows hold only mutable
    // state (stock/hidden); the catalog itself lives in src/data/prize-wall.ts.
    // A stock attribute means finite stock; absent means unlimited.
    const prize = new sst.aws.Dynamo("Prize", {
      fields: { prizeId: "string" },
      primaryIndex: { hashKey: "prizeId" },
    });
    // One row per redemption request. Partition per player reads their
    // history in time order (ULID range key); the admin queue is a scan.
    const redemption = new sst.aws.Dynamo("Redemption", {
      fields: { playerId: "string", redemptionId: "string" },
      primaryIndex: { hashKey: "playerId", rangeKey: "redemptionId" },
    });
```

- [ ] **Step 2: Add the admin webhook secret**

Next to the `podsWebhookUrl` secret:

```ts
    // Discord incoming webhook for the private admins channel: redemption pings.
    const adminWebhookUrl = new sst.Secret("AdminWebhookUrl");
```

- [ ] **Step 3: Link the new resources**

In the `sst.aws.Nextjs("Web", ...)` `link` array, add `prize`, `redemption`, `adminWebhookUrl`.

In the `MeleeSync` cron function's `link` array, add `account`, `pointsLedger`, `playerBalance` (the sync will reconcile placement credits, Task 5).

- [ ] **Step 4: Get the webhook URL from Alex**

STOP and ask Alex for the admin-channel webhook URL. He creates it in Discord: private admins channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL. Do not proceed to Step 5 without it; the deploy fails if a linked secret has no value.

- [ ] **Step 5: Set the secret**

```bash
npx sst secret set AdminWebhookUrl "<url from Alex>" --stage production
```

- [ ] **Step 6: Deploy the infra**

First check `git status` for another session's uncommitted work; if present, stop and ask rather than shipping it. Then (never pipe deploy output into `tail`/`grep`; the pipe's exit code masks failures):

```bash
npx sst deploy --stage production > /tmp/deploy.log 2>&1; echo "exit: $?"
```

**Expected: the first deploy FAILS** with `Property 'Prize' does not exist on type 'Resource'` (known gotcha: sst-env.d.ts is written while the build typechecks). Re-run the same command; the second deploy should succeed with exit 0. Check `/tmp/deploy.log` on any other error.

- [ ] **Step 7: Document the secret**

In `docs/setup.md`, wherever the SST secrets are listed (search for `PodsWebhookUrl`), add a line for `AdminWebhookUrl`: Discord incoming webhook for the private admins channel, used for redemption pings.

- [ ] **Step 8: Commit**

```bash
git add website/sst.config.ts docs/setup.md
git commit -m "Add Prize and Redemption tables and the admin webhook secret

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Ledger extensions (types, balance ops, reconciliation)

**Files:**
- Create: `website/src/lib/dynamo.ts`
- Modify: `website/src/lib/ledger.ts`
- Modify: `website/src/lib/pods-db.ts` (import `isConditionFailure` instead of defining it)
- Test: `website/src/lib/ledger.test.ts`

**Interfaces:**
- Consumes: `listTournaments()`, `getPlacements(meleeId)` from `./db.ts` (exist today).
- Produces (all from `./ledger.ts` unless noted):
  - `isConditionFailure(err: unknown): boolean` — from `./dynamo.ts`
  - Widened `LedgerEntry`: `kind` adds `"redemption" | "placement"`, `refType` becomes `"pod_match" | "redemption" | "placement"`, `day?: string` now optional
  - `entryPut(entry: LedgerEntry, opts?: { once?: boolean })` — `once` adds `ConditionExpression: "attribute_not_exists(entryId)"`
  - `type Balance = { currencyBalance: number; lifetimeEarned: number; lifetimeSpent: number }`
  - `getBalance(playerId: string): Promise<Balance>` — zeros when no row
  - `balanceDebit(playerId: string, amount: number)` — transact element, conditional on funds
  - `balanceRefund(playerId: string, amount: number)` — transact element, no condition
  - `placementEntryId(meleeId: number): string` — `` `plc-${meleeId}` ``
  - `missingCredits(placements, meleeUserIdentity, existingEntryIds): { meleeId: number; amount: number }[]` — pure
  - `reconcilePlayer(discordUserId: string, meleeUserIdentity: string): Promise<number>` — credits owed placements, returns count
  - `reconcilePlacementCredits(linked: Map<string, string>): Promise<number>` — same for every linked account (map is meleeUserIdentity → discordUserId)

- [ ] **Step 1: Write the failing tests**

Create `website/src/lib/ledger.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { missingCredits, placementEntryId } from "./ledger.ts";

const plc = (meleeId: number, meleeUserIdentity: string, currencyPointsAwarded: number) => ({
  meleeId, meleeUserIdentity, currencyPointsAwarded,
});

test("credits every uncredited placement for the identity", () => {
  const owed = missingCredits(
    [plc(101, "m1", 250), plc(102, "m1", 100)], "m1", new Set(),
  );
  assert.deepEqual(owed, [
    { meleeId: 101, amount: 250 },
    { meleeId: 102, amount: 100 },
  ]);
});

test("other identities' placements are not mine", () => {
  assert.deepEqual(missingCredits([plc(101, "m2", 250)], "m1", new Set()), []);
});

test("an existing plc- entry means that tournament is already paid", () => {
  const owed = missingCredits(
    [plc(101, "m1", 250), plc(102, "m1", 100)], "m1", new Set([placementEntryId(101)]),
  );
  assert.deepEqual(owed, [{ meleeId: 102, amount: 100 }]);
});

test("zero-currency placements write no entry", () => {
  assert.deepEqual(missingCredits([plc(101, "m1", 0)], "m1", new Set()), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test src/lib/ledger.test.ts
```

Expected: FAIL, `missingCredits` is not exported.

- [ ] **Step 3: Create `src/lib/dynamo.ts`**

Move `isConditionFailure` verbatim from `pods-db.ts` (lines 28-36):

```ts
// Shared Dynamo error classification.
export function isConditionFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "ConditionalCheckFailedException") return true;
  if (err.name !== "TransactionCanceledException") return false;
  // A transact cancellation is a benign race only when every per-item reason
  // is a condition failure; throttling/conflict/validation must surface.
  const reasons = (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
  return !!reasons && reasons.every((r) => !r.Code || r.Code === "ConditionalCheckFailed" || r.Code === "None");
}
```

In `pods-db.ts`: delete the local definition and add `import { isConditionFailure } from "./dynamo.ts";`.

- [ ] **Step 4: Extend `src/lib/ledger.ts`**

Update imports (add `GetCommand`, `TransactWriteCommand` to the lib-dynamodb import) and add:

```ts
import { listTournaments, getPlacements } from "./db.ts";
import { isConditionFailure } from "./dynamo.ts";
```

Widen the type. `day` becomes optional and is OMITTED on redemption/placement entries: `paidToday` filters on `day`, so a day-less entry can never distort the pods settle-up.

```ts
export type LedgerEntry = {
  playerId: string;   // Discord snowflake: everything in this table keys on the Discord ID
  entryId: string;    // ULID, or a deterministic id (plc-/rfd- prefixed) where idempotency matters
  kind: "pod_win" | "adjustment" | "redemption" | "placement";
  rankingDelta: 0;    // this ledger never moves competitive standing (ADR 0004)
  currencyDelta: number;
  /** clubDay settle-up bucket. Pod kinds only; omitted on redemption and
      placement entries so paidToday's day filter never sees them. */
  day?: string;
  refType: "pod_match" | "redemption" | "placement";
  refId: string;
  note?: string;
  createdAt: string;
};
```

Extend `entryPut` (existing callers pass no options, so nothing breaks):

```ts
/** TransactWriteItems element appending one ledger entry. `once` makes a
    deterministic entryId idempotent: a second write is a condition failure. */
export function entryPut(entry: LedgerEntry, { once = false } = {}) {
  return {
    Put: {
      TableName: LEDGER(),
      Item: entry,
      ...(once ? { ConditionExpression: "attribute_not_exists(entryId)" } : {}),
    },
  };
}
```

Add balance reads and spend/refund elements:

```ts
export type Balance = { currencyBalance: number; lifetimeEarned: number; lifetimeSpent: number };

export async function getBalance(playerId: string): Promise<Balance> {
  const res = await doc.send(new GetCommand({ TableName: BALANCE(), Key: { playerId } }));
  return { currencyBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0, ...(res.Item ?? {}) };
}

/** TransactWriteItems element spending from a balance; fails when funds are short. */
export function balanceDebit(playerId: string, amount: number) {
  return {
    Update: {
      TableName: BALANCE(),
      Key: { playerId },
      UpdateExpression: "ADD currencyBalance :neg, lifetimeSpent :a",
      ConditionExpression: "currencyBalance >= :a",
      ExpressionAttributeValues: { ":a": amount, ":neg": -amount },
    },
  };
}

/** TransactWriteItems element returning a cancelled redemption's points. */
export function balanceRefund(playerId: string, amount: number) {
  return {
    Update: {
      TableName: BALANCE(),
      Key: { playerId },
      UpdateExpression: "ADD currencyBalance :a, lifetimeSpent :neg",
      ExpressionAttributeValues: { ":a": amount, ":neg": -amount },
    },
  };
}
```

Add the reconciliation (the currency bridge, spec 2026-07-30):

```ts
/** Deterministic entryId for a tournament's placement credit: every path that
    could pay it (approval, cron, script, --force re-import) collides here. */
export function placementEntryId(meleeId: number): string {
  return `plc-${meleeId}`;
}

/** The placement credits this player is still owed. Pure; caller supplies state. */
export function missingCredits(
  placements: { meleeId: number; meleeUserIdentity: string; currencyPointsAwarded: number }[],
  meleeUserIdentity: string,
  existingEntryIds: Set<string>,
): { meleeId: number; amount: number }[] {
  return placements
    .filter((p) => p.meleeUserIdentity === meleeUserIdentity && p.currencyPointsAwarded > 0)
    .filter((p) => !existingEntryIds.has(placementEntryId(p.meleeId)))
    .map((p) => ({ meleeId: p.meleeId, amount: p.currencyPointsAwarded }));
}

async function placementCreditIds(playerId: string): Promise<Set<string>> {
  const res = await doc.send(new QueryCommand({
    TableName: LEDGER(),
    KeyConditionExpression: "playerId = :p AND begins_with(entryId, :plc)",
    ExpressionAttributeValues: { ":p": playerId, ":plc": "plc-" },
  }));
  return new Set(((res.Items ?? []) as LedgerEntry[]).map((e) => e.entryId));
}

async function creditMissing(
  discordUserId: string,
  meleeUserIdentity: string,
  placements: { meleeId: number; meleeUserIdentity: string; currencyPointsAwarded: number }[],
): Promise<number> {
  const existing = await placementCreditIds(discordUserId);
  const owed = missingCredits(placements, meleeUserIdentity, existing);
  const now = new Date().toISOString();
  let credited = 0;
  for (const { meleeId, amount } of owed) {
    try {
      await doc.send(new TransactWriteCommand({ TransactItems: [
        entryPut({
          playerId: discordUserId, entryId: placementEntryId(meleeId),
          kind: "placement", rankingDelta: 0, currencyDelta: amount,
          refType: "placement", refId: `${meleeId}#${meleeUserIdentity}`,
          createdAt: now,
        }, { once: true }),
        balanceCredit(discordUserId, amount),
      ]}));
      credited++;
    } catch (err) {
      if (!isConditionFailure(err)) throw err; // a concurrent reconcile already paid it
    }
  }
  return credited;
}

async function allPlacements() {
  const tournaments = await listTournaments();
  const perEvent = await Promise.all(tournaments.map((t) => getPlacements(t.meleeId)));
  return perEvent.flat();
}

/**
 * Credit any tournament placements the ledger has not paid this player yet.
 * Idempotent and safe to run any time: claim approval calls it as the
 * full-history opening credit, and the weekly cron re-runs it for every
 * linked player, so a credit lost to a crash self-heals a week later at worst.
 */
export async function reconcilePlayer(discordUserId: string, meleeUserIdentity: string): Promise<number> {
  return creditMissing(discordUserId, meleeUserIdentity, await allPlacements());
}

// ponytail: one full placement sweep per run (~30 queries at dozens scale);
// cache per-identity or add a Placement GSI if the club outgrows it.
export async function reconcilePlacementCredits(linked: Map<string, string>): Promise<number> {
  const placements = await allPlacements();
  let credited = 0;
  for (const [meleeUserIdentity, discordUserId] of linked) {
    credited += await creditMissing(discordUserId, meleeUserIdentity, placements);
  }
  return credited;
}
```

(`QueryCommand` is already imported in `ledger.ts`.)

- [ ] **Step 5: Run the tests and typecheck**

```bash
node --test src/lib/ledger.test.ts && node --test src/lib/*.test.ts && npx tsc --noEmit
```

Expected: all PASS (the full-glob run proves pods tests still pass with the widened type and the `pods-db.ts` import move).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dynamo.ts src/lib/ledger.ts src/lib/ledger.test.ts src/lib/pods-db.ts
git commit -m "Extend the ledger for redemptions and placement reconciliation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Prize catalog ids and pure prize logic

**Files:**
- Modify: `website/src/data/prize-wall.ts`
- Create: `website/src/lib/prizes.ts`
- Test: `website/src/lib/prizes.test.ts`

**Interfaces:**
- Produces:
  - `PrizeWallItem.id: string` (new required field; stable kebab-case slug)
  - From `./prizes.ts`: `type PrizeRow = { prizeId: string; stock?: number; hidden?: boolean }`
  - `type RedemptionRow = { playerId: string; redemptionId: string; prizeId: string; displayName: string; costAtRedemption: number; status: "pending" | "fulfilled" | "cancelled"; requestedAt: string; fulfilledAt?: string; note?: string }`
  - `prizeById(prizeId: string): PrizeWallItem | undefined`
  - `redeemError(item: PrizeWallItem | undefined, row: PrizeRow | undefined, balance: number, linked: boolean): string | null`

- [ ] **Step 1: Write the failing tests**

Create `website/src/lib/prizes.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { PRIZE_WALL } from "../data/prize-wall.ts";
import { redeemError, type PrizeRow } from "./prizes.ts";

test("catalog ids are unique, kebab-case slugs", () => {
  const ids = PRIZE_WALL.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});

const item = PRIZE_WALL[0]; // any real item works; guards only read .points
const row = (over: Partial<PrizeRow> = {}): PrizeRow => ({ prizeId: item.id, ...over });

test("unknown item is not on the wall", () => {
  assert.match(redeemError(undefined, undefined, 99999, true)!, /not on the wall/);
});

test("hidden item is not on the wall", () => {
  assert.match(redeemError(item, row({ hidden: true }), 99999, true)!, /not on the wall/);
});

test("unlinked players must link first", () => {
  assert.match(redeemError(item, undefined, 99999, false)!, /[Ll]ink/);
});

test("a zero-stock item is sold out", () => {
  assert.match(redeemError(item, row({ stock: 0 }), 99999, true)!, /Sold out/);
});

test("a short balance cannot redeem, even on an unlimited item", () => {
  assert.match(redeemError(item, undefined, item.points - 1, true)!, /Not enough points/);
});

test("linked, funded, in stock: allowed", () => {
  assert.equal(redeemError(item, row({ stock: 3 }), item.points, true), null);
});

test("no Prize row means unlimited: allowed", () => {
  assert.equal(redeemError(item, undefined, item.points, true), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test src/lib/prizes.test.ts
```

Expected: FAIL (`./prizes.ts` does not exist; `id` missing from catalog items).

- [ ] **Step 3: Add `id` to the catalog**

In `website/src/data/prize-wall.ts`, add to the type (first field):

```ts
export type PrizeWallItem = {
  /** Stable slug; the Prize/Redemption tables key on it, so never rename one casually. */
  id: string;
  name: string;
  ...
```

Give every item an `id` matching its image basename (which is already a clean slug): `metal-token-set`, `mother-talzin-playmat`, `sneaking-suspicion-playmat`, `shien-flurry-playmat`, `darth-tyrannus-playmat`, `princess-leia-playmat`, `mandalorian-spy-token`, `metal-advantage-token`, `x-wing-tie-fighter-token`, `metal-imperial-credit-token`, `metal-old-republic-credit-token`, `metal-force-token`, `beskar-initiative-token`, `metal-twin-suns-token-set`, `metal-damage-token`, `metal-epic-action-reminder-token`, `metal-experience-token`, `metal-hand-token`, `metal-hidden-sentinel-token`, `metal-initiative-token-data-card`, `metal-modifier-token`, `metal-shield-token`.

Also switch the React key in `src/app/prizes/page.tsx` from `key={item.name}` to `key={item.id}` (one-line change; the page rewrite comes in Task 6).

- [ ] **Step 4: Create `src/lib/prizes.ts`**

```ts
// Prize wall domain types and guards (redemption spec 2026-07-30). The
// catalog is code (src/data/prize-wall.ts); Dynamo holds only mutable state.
import { PRIZE_WALL, type PrizeWallItem } from "../data/prize-wall.ts";

/** Mutable per-item state. A stock attribute means finite; absent means unlimited. */
export type PrizeRow = { prizeId: string; stock?: number; hidden?: boolean };

export type RedemptionRow = {
  playerId: string;        // Discord snowflake
  redemptionId: string;    // ULID
  prizeId: string;
  displayName: string;     // snapshot at request time, for the admin queue
  costAtRedemption: number; // snapshot: repricing never rewrites what was paid
  status: "pending" | "fulfilled" | "cancelled";
  requestedAt: string;
  fulfilledAt?: string;
  note?: string;
};

export function prizeById(prizeId: string): PrizeWallItem | undefined {
  return PRIZE_WALL.find((p) => p.id === prizeId);
}

/** Why this redemption is not allowed, or null if it is. Pure; caller supplies state. */
export function redeemError(
  item: PrizeWallItem | undefined,
  row: PrizeRow | undefined,
  balance: number,
  linked: boolean,
): string | null {
  if (!item || row?.hidden) return "That item is not on the wall.";
  if (!linked) return "Link your melee results on your card first.";
  if (row?.stock !== undefined && row.stock <= 0) return "Sold out.";
  if (balance < item.points) return "Not enough points.";
  return null;
}
```

- [ ] **Step 5: Run the tests and typecheck**

```bash
node --test src/lib/prizes.test.ts && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/prize-wall.ts src/lib/prizes.ts src/lib/prizes.test.ts src/app/prizes/page.tsx
git commit -m "Add catalog ids and pure prize redemption guards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Redemption I/O and the admin webhook

**Files:**
- Modify: `website/src/lib/discord.ts`
- Create: `website/src/lib/prizes-db.ts`

**Interfaces:**
- Consumes: Task 2's ledger exports, Task 3's types/guards, `getAccount` from `./accounts.ts`, `ulid` from `./ulid.ts`, `isConditionFailure` from `./dynamo.ts`.
- Produces (from `./prizes-db.ts`):
  - `allPrizeRows(): Promise<Map<string, PrizeRow>>`
  - `redeem(playerId: string, displayName: string, prizeId: string): Promise<void>` — throws Error with a player-facing message on any refusal
  - `pendingRedemptions(): Promise<RedemptionRow[]>` — oldest first
  - `playerRedemptions(playerId: string): Promise<RedemptionRow[]>` — newest first
  - `fulfilRedemption(playerId: string, redemptionId: string): Promise<void>`
  - `cancelRedemption(playerId: string, redemptionId: string, note?: string): Promise<void>`
  - `setStock(prizeId: string, stock: number): Promise<void>`
  - `clearStock(prizeId: string): Promise<void>`
  - `setHidden(prizeId: string, hidden: boolean): Promise<void>`
- Produces (from `./discord.ts`): `announceAdmin(content: string): Promise<void>`

- [ ] **Step 1: Add `announceAdmin` to `src/lib/discord.ts`**

Refactor the shared fetch into a private helper; both announce functions stay best-effort:

```ts
// Discord incoming webhooks (no bot user): pod announcements to the public
// channel, redemption pings to the private admins channel.
import { Resource } from "sst";

export const SITE_URL = "https://bluemilkgaming.com";

/** Best effort by design: a lost Discord message never blocks the write it follows. */
async function post(url: string, content: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallowed: announcing is never worth failing the write it follows.
  }
}

export async function announce(content: string): Promise<void> {
  return post(Resource.PodsWebhookUrl.value, content);
}

export async function announceAdmin(content: string): Promise<void> {
  return post(Resource.AdminWebhookUrl.value, content);
}
```

- [ ] **Step 2: Create `src/lib/prizes-db.ts`**

```ts
// Prize wall Dynamo I/O (redemption spec 2026-07-30). The redemption is one
// transaction (ADR 0004): debit conditional on funds, stock decrement
// conditional on stock, the Redemption row, the ledger entry. Either all
// land or none, which is what makes two players racing for the last
// playmat safe.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand,
  UpdateCommand, TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { ulid } from "./ulid.ts";
import { isConditionFailure } from "./dynamo.ts";
import { getBalance, balanceDebit, balanceRefund, entryPut, type LedgerEntry } from "./ledger.ts";
import { getAccount } from "./accounts.ts";
import { prizeById, redeemError, type PrizeRow, type RedemptionRow } from "./prizes.ts";
import { announceAdmin, SITE_URL } from "./discord.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const PRIZE = () => Resource.Prize.name;
const REDEMPTION = () => Resource.Redemption.name;

// ponytail: full-table scans below (Prize is ~20 rows, Redemption grows by a
// few a week). A byStatus sparse GSI is the upgrade if either ever hurts.
export async function allPrizeRows(): Promise<Map<string, PrizeRow>> {
  const res = await doc.send(new ScanCommand({ TableName: PRIZE() }));
  return new Map(((res.Items ?? []) as PrizeRow[]).map((r) => [r.prizeId, r]));
}

export async function redeem(playerId: string, displayName: string, prizeId: string): Promise<void> {
  const [account, balance, rows] = await Promise.all([
    getAccount(playerId), getBalance(playerId), allPrizeRows(),
  ]);
  const item = prizeById(prizeId);
  const row = rows.get(prizeId);
  const error = redeemError(item, row, balance.currencyBalance, !!account?.meleeUserIdentity);
  if (error) throw new Error(error);

  const cost = item!.points;
  const redemption: RedemptionRow = {
    playerId, redemptionId: ulid(), prizeId, displayName,
    costAtRedemption: cost, status: "pending", requestedAt: new Date().toISOString(),
  };
  type TransactItems = NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  >;
  const items: TransactItems = [
    balanceDebit(playerId, cost),
    { Put: { TableName: REDEMPTION(), Item: redemption } },
    entryPut({
      playerId, entryId: redemption.redemptionId, kind: "redemption",
      rankingDelta: 0, currencyDelta: -cost,
      refType: "redemption", refId: redemption.redemptionId,
      createdAt: redemption.requestedAt,
    } satisfies LedgerEntry),
  ];
  if (row?.stock !== undefined) {
    items.push({
      Update: {
        TableName: PRIZE(),
        Key: { prizeId },
        UpdateExpression: "ADD stock :neg",
        ConditionExpression: "stock >= :one",
        ExpressionAttributeValues: { ":neg": -1, ":one": 1 },
      },
    });
  }
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (isConditionFailure(err))
      throw new Error("That did not go through. Check your points, someone may also have beaten you to the last one.");
    throw err;
  }
  await announceAdmin(
    `**${displayName}** redeemed **${item!.name}** for ${cost.toLocaleString("en-US")} pts: ${SITE_URL}/admin/prizes`,
  );
}

export async function pendingRedemptions(): Promise<RedemptionRow[]> {
  const res = await doc.send(new ScanCommand({
    TableName: REDEMPTION(),
    FilterExpression: "#s = :p",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":p": "pending" },
  }));
  // ULIDs sort by creation time, so this is oldest request first.
  return ((res.Items ?? []) as RedemptionRow[]).sort((a, b) =>
    a.redemptionId < b.redemptionId ? -1 : 1);
}

export async function playerRedemptions(playerId: string): Promise<RedemptionRow[]> {
  const res = await doc.send(new QueryCommand({
    TableName: REDEMPTION(),
    KeyConditionExpression: "playerId = :p",
    ExpressionAttributeValues: { ":p": playerId },
    ScanIndexForward: false, // newest first
  }));
  return (res.Items ?? []) as RedemptionRow[];
}

export async function fulfilRedemption(playerId: string, redemptionId: string): Promise<void> {
  try {
    await doc.send(new UpdateCommand({
      TableName: REDEMPTION(),
      Key: { playerId, redemptionId },
      UpdateExpression: "SET #s = :f, fulfilledAt = :now",
      ConditionExpression: "#s = :p",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":f": "fulfilled", ":p": "pending", ":now": new Date().toISOString() },
    }));
  } catch (err) {
    if (isConditionFailure(err)) throw new Error("That redemption was already handled.");
    throw err;
  }
}

/** Cancel and refund in one transaction: points back, stock back if tracked. */
export async function cancelRedemption(playerId: string, redemptionId: string, note?: string): Promise<void> {
  const res = await doc.send(new GetCommand({ TableName: REDEMPTION(), Key: { playerId, redemptionId } }));
  const redemption = res.Item as RedemptionRow | undefined;
  if (!redemption || redemption.status !== "pending")
    throw new Error("That redemption was already handled.");

  const cost = redemption.costAtRedemption;
  const row = (await allPrizeRows()).get(redemption.prizeId);
  type TransactItems = NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  >;
  const items: TransactItems = [
    {
      Update: {
        TableName: REDEMPTION(),
        Key: { playerId, redemptionId },
        UpdateExpression: "SET #s = :c" + (note ? ", note = :n" : ""),
        ConditionExpression: "#s = :p",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":c": "cancelled", ":p": "pending", ...(note ? { ":n": note } : {}),
        },
      },
    },
    balanceRefund(playerId, cost),
    entryPut({
      playerId, entryId: `rfd-${redemptionId}`, kind: "redemption",
      rankingDelta: 0, currencyDelta: cost,
      refType: "redemption", refId: redemptionId,
      note: note ?? "cancelled", createdAt: new Date().toISOString(),
    } satisfies LedgerEntry, { once: true }),
  ];
  if (row?.stock !== undefined) {
    items.push({
      Update: {
        TableName: PRIZE(),
        Key: { prizeId: redemption.prizeId },
        UpdateExpression: "ADD stock :one",
        // Guards the race where an admin just cleared stock: ADD on a missing
        // row would otherwise resurrect it as a stock-1 item.
        ConditionExpression: "attribute_exists(prizeId)",
        ExpressionAttributeValues: { ":one": 1 },
      },
    });
  }
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if (isConditionFailure(err)) throw new Error("That redemption was already handled.");
    throw err;
  }
}

export async function setStock(prizeId: string, stock: number): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: PRIZE(),
    Key: { prizeId },
    UpdateExpression: "SET stock = :n",
    ExpressionAttributeValues: { ":n": stock },
  }));
}

/** Back to unlimited. The row may linger holding only `hidden`; that is fine. */
export async function clearStock(prizeId: string): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: PRIZE(),
    Key: { prizeId },
    UpdateExpression: "REMOVE stock",
  }));
}

export async function setHidden(prizeId: string, hidden: boolean): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: PRIZE(),
    Key: { prizeId },
    UpdateExpression: hidden ? "SET hidden = :h" : "REMOVE hidden",
    ...(hidden ? { ExpressionAttributeValues: { ":h": true } } : {}),
  }));
}
```

- [ ] **Step 3: Typecheck and run all tests**

```bash
npx tsc --noEmit && node --test src/lib/*.test.ts
```

Expected: clean. (No new unit tests: this file is I/O wiring; its guard logic was tested pure in Task 3, and the transaction is exercised end to end in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/discord.ts src/lib/prizes-db.ts
git commit -m "Add redemption transactions, stock ops and the admin webhook

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Currency bridge wiring (approval, sync, launch script)

**Files:**
- Modify: `website/src/lib/accounts.ts`
- Modify: `website/src/lib/sync.ts`
- Create: `website/scripts/backfill-linked.ts`

**Interfaces:**
- Consumes: `reconcilePlayer`, `reconcilePlacementCredits` from `./ledger.ts` (Task 2).
- Produces: `linkedIdentityMap(): Promise<Map<string, string>>` from `./accounts.ts` (meleeUserIdentity → discordUserId).

- [ ] **Step 1: Add `linkedIdentityMap` to `src/lib/accounts.ts`**

Below `allAccounts`:

```ts
/** meleeUserIdentity → discordUserId for every linked account. */
export async function linkedIdentityMap(): Promise<Map<string, string>> {
  const accounts = await allAccounts();
  return new Map(
    accounts.flatMap((a) => (a.meleeUserIdentity ? [[a.meleeUserIdentity, a.discordUserId] as const] : [])),
  );
}
```

- [ ] **Step 2: Reconcile at claim approval**

In `accounts.ts`, add `import { reconcilePlayer } from "./ledger.ts";`. In `resolveClaim`'s approve branch, immediately after the existing `UpdateCommand` that sets `meleeUserIdentity` succeeds, add:

```ts
    // The opening credit: pay out the full tournament history now that the
    // Discord account and the melee identity are one player. Idempotent, and
    // the weekly cron re-runs it, so a crash here self-heals on Monday.
    await reconcilePlayer(discordUserId, account.pendingClaim);
    return;
```

(The link write stays a plain conditional update, not a transaction: if the reconcile crashes after it, the cron's weekly reconcile completes the credits.)

- [ ] **Step 3: Reconcile at weekly sync**

In `src/lib/sync.ts`, add imports:

```ts
import { linkedIdentityMap } from "./accounts.ts";
import { reconcilePlacementCredits } from "./ledger.ts";
```

At the end of `syncTournaments`, after the summary `console.log` and before `return result;`:

```ts
  // Placement credits for linked players (redemption spec 2026-07-30): pays
  // this week's placements and self-heals any credit an earlier crash lost.
  const credited = await reconcilePlacementCredits(await linkedIdentityMap());
  console.log(`${credited} placement credit(s) written`);
```

- [ ] **Step 4: Create `scripts/backfill-linked.ts`**

```ts
// One-time launch backfill: pay tournament history to accounts linked before
// the prize wall existed. Safe to re-run; reconciliation is idempotent. Run:
//   npx sst shell --stage production -- node scripts/backfill-linked.ts
import { linkedIdentityMap } from "../src/lib/accounts.ts";
import { reconcilePlacementCredits } from "../src/lib/ledger.ts";

const linked = await linkedIdentityMap();
const credited = await reconcilePlacementCredits(linked);
console.log(`${linked.size} linked account(s), ${credited} placement credit(s) written`);
```

- [ ] **Step 5: Typecheck and run all tests**

```bash
npx tsc --noEmit && node --test src/lib/*.test.ts
```

Expected: clean (accounts tests untouched by the approve-path addition; they cover the pure guards).

- [ ] **Step 6: Commit**

```bash
git add src/lib/accounts.ts src/lib/sync.ts scripts/backfill-linked.ts
git commit -m "Credit tournament placements to linked balances via reconciliation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: The wall goes transactional (/prizes)

**Files:**
- Modify: `website/src/app/prizes/page.tsx`
- Create: `website/src/app/prizes/actions.ts`
- Create: `website/src/app/prizes/redeem-button.tsx`

**Interfaces:**
- Consumes: `allPrizeRows`, `redeem` (Task 4); `getBalance` (Task 2); `getAccount` (exists); `auth` (exists).
- Produces: `redeemAction(prevState, formData): Promise<{ error: string } | { ok: true } | null>` for the client button.

- [ ] **Step 1: Create `src/app/prizes/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { redeem } from "@/lib/prizes-db";

export async function redeemAction(
  prevState: { error: string } | { ok: true } | null,
  formData: FormData,
): Promise<{ error: string } | { ok: true } | null> {
  const session = await auth();
  if (!session) return { error: "Sign in on your card first." };
  const prizeId = String(formData.get("prizeId") ?? "");
  try {
    await redeem(session.user.discordUserId, session.user.name, prizeId);
    revalidatePath("/prizes");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "redemption failed";
    return { error: message };
  }
}
```

- [ ] **Step 2: Create `src/app/prizes/redeem-button.tsx`**

Two-step arm-then-confirm, because a misclicked 1,500-point spend is a bad Sunday:

```tsx
"use client";
import { useActionState, useState } from "react";
import { redeemAction } from "./actions";

export function RedeemButton({ prizeId, points }: { prizeId: string; points: number }) {
  const [state, formAction, pending] = useActionState(redeemAction, null);
  const [armed, setArmed] = useState(false);
  return (
    <div className="mt-3">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!armed) {
            e.preventDefault();
            setArmed(true);
          }
        }}
      >
        <input type="hidden" name="prizeId" value={prizeId} />
        <button
          disabled={pending}
          className="cursor-pointer rounded-full bg-[var(--hot)] px-5 py-2 text-sm font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:cursor-not-allowed"
        >
          {pending
            ? "Redeeming…"
            : armed
              ? `Spend ${points.toLocaleString("en-US")} pts?`
              : "Redeem"}
        </button>
      </form>
      {state && "error" in state && (
        <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p className="mt-2 text-sm font-extrabold">
          Yours. The shopkeeper will DM you on Discord.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `src/app/prizes/page.tsx`**

Keep the visual shell (StoreStyles, header, h1, pegboard, footer, bottom links) and make the wall live. The full new file:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/accounts";
import { getBalance } from "@/lib/ledger";
import { allPrizeRows } from "@/lib/prizes-db";
import { DISCORD_URL } from "@/data/season";
import { PRIZE_WALL } from "@/data/prize-wall";
import { StoreStyles } from "../store-styles";
import { SiteHeader, SiteFooter } from "../site-chrome";
import { RedeemButton } from "./redeem-button";

/*
  The full prize wall (The Local world, DESIGN.md), priced per the approved
  pricing design (docs/superpowers/specs/2026-07-29-prize-wall-pricing-
  design.md), transactional per the redemption design (2026-07-30): stock
  from the Prize table, redemption in one conditional transaction.
*/

export const dynamic = "force-dynamic"; // session + live stock, never prerender

export const metadata: Metadata = {
  title: "The Prize Wall — Blue Milk Gaming",
  description:
    "Points from the weekly Online Local buy things off the prize wall.",
};

export default async function PrizeWallPage() {
  const [session, rows] = await Promise.all([auth(), allPrizeRows()]);
  const discordUserId = session?.user.discordUserId;
  const [account, balance] = discordUserId
    ? await Promise.all([getAccount(discordUserId), getBalance(discordUserId)])
    : [undefined, undefined];
  const linked = !!account?.meleeUserIdentity;
  const points = balance?.currencyBalance ?? 0;
  const items = PRIZE_WALL.filter((item) => !rows.get(item.id)?.hidden);
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <SiteHeader current="/prizes" />
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <span className="tape">The prize wall</span>
        <h1 className="display mt-6 text-[clamp(2.75rem,7vw,5rem)]">
          The wall
          <br />
          is up.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-[color-mix(in_srgb,var(--paper)_75%,transparent)]">
          Top finishes at the Sunday Online Local earn points, and wins at the
          Tables add more. Points buy things right off this wall.
        </p>
        {session ? (
          linked ? (
            <p className="mt-4 text-lg font-extrabold text-[var(--accent)]">
              You have {points.toLocaleString("en-US")} pts to spend.
            </p>
          ) : (
            <p className="mt-4 text-lg font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)]">
              <Link href="/account" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">
                Link your melee results
              </Link>{" "}
              to spend your points.
            </p>
          )
        ) : (
          <p className="mt-4 text-lg font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)]">
            <Link href="/account" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">
              Sign in
            </Link>{" "}
            to spend your points.
          </p>
        )}
        <div className="pegboard mt-12 rounded-xl border-2 border-[color-mix(in_srgb,var(--paper)_40%,transparent)] p-8 shadow-[0_18px_40px_-18px_rgba(0,2,28,0.9)] sm:p-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const row = rows.get(item.id);
              const soldOut = row?.stock !== undefined && row.stock <= 0;
              return (
                <div
                  key={item.id}
                  className={`tilt-r paper p-6 pt-5 text-center${soldOut ? " opacity-60 grayscale" : ""}`}
                >
                  <span aria-hidden="true" className="mx-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--wall-deep)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--paper)_45%,var(--wall-deep))]" />
                  </span>
                  {item.imageUrl && (
                    // Pre-sized local images (public/prize-images); images.unoptimized
                    // is set, so next/image would add nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      className="mx-auto mt-4 aspect-square w-full max-w-44 object-contain"
                    />
                  )}
                  <p className="mt-4 text-xl font-extrabold leading-tight">{item.name}</p>
                  {item.by && (
                    <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                      from {item.by}
                    </p>
                  )}
                  <p className="mt-4 border-t-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-3 text-lg font-extrabold text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]">
                    {item.points.toLocaleString("en-US")} pts
                  </p>
                  {soldOut ? (
                    <p className="mt-3 inline-block bg-[color-mix(in_srgb,var(--ink)_15%,transparent)] px-3 py-1 text-sm font-extrabold">
                      Claimed
                    </p>
                  ) : linked ? (
                    points >= item.points ? (
                      <RedeemButton prizeId={item.id} points={item.points} />
                    ) : (
                      <p className="mt-3 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_50%,transparent)]">
                        Not enough points yet
                      </p>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="tilt-r mt-8 inline-block bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-4 py-2.5 text-sm font-extrabold">
            Redeem here and the shopkeeper will DM you on Discord to sort
            delivery. Small items ship together with your next redemption.
          </p>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-[var(--hot)] px-8 py-4 text-lg font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2"
          >
            Play for points Sunday
          </a>
          <Link
            href="/standings"
            className="font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          >
            Check the standings →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/prizes
git commit -m "Make the prize wall stock-aware with a transactional redeem

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Balance and history on the card (/account)

**Files:**
- Modify: `website/src/app/account/page.tsx`

**Interfaces:**
- Consumes: `getBalance` (Task 2), `playerRedemptions` (Task 4), `prizeById` (Task 3).

- [ ] **Step 1: Extend `SignedIn`**

Add imports to `src/app/account/page.tsx`:

```tsx
import Link from "next/link";
import { getBalance } from "@/lib/ledger";
import { playerRedemptions } from "@/lib/prizes-db";
import { prizeById } from "@/lib/prizes";
```

Replace `SignedIn`'s first line so the three reads run together:

```tsx
async function SignedIn({ name, discordUserId }: { name: string; discordUserId: string }) {
  const [account, balance, redemptions] = await Promise.all([
    ensureAccount(discordUserId, name),
    getBalance(discordUserId),
    playerRedemptions(discordUserId),
  ]);
```

After the linked/pending/claim-form block (before the sign-out form), add:

```tsx
      <p className="mt-6 border-t-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-4 text-lg font-extrabold">
        {balance.currencyBalance.toLocaleString("en-US")} pts to spend.{" "}
        <Link href="/prizes" className="underline decoration-[var(--accent)] decoration-2 underline-offset-4">
          See the wall
        </Link>
      </p>
      {redemptions.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
            Redemptions
          </h2>
          <ul className="mt-2 space-y-2">
            {redemptions.map((r) => (
              <li key={r.redemptionId} className="text-sm font-extrabold">
                {prizeById(r.prizeId)?.name ?? r.prizeId}, {r.costAtRedemption.toLocaleString("en-US")} pts,{" "}
                {r.status}, {r.requestedAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/account/page.tsx
git commit -m "Show the points balance and redemption history on the card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Admin prizes page (queue + stock)

**Files:**
- Modify: `website/src/lib/auth.ts` (add `requireAdmin`)
- Modify: `website/src/app/admin/claims/actions.ts` (use it)
- Create: `website/src/app/admin/prizes/page.tsx`
- Create: `website/src/app/admin/prizes/actions.ts`
- Create: `website/src/app/admin/prizes/redemption-actions.tsx`
- Create: `website/src/app/admin/prizes/stock-editor.tsx`

**Interfaces:**
- Consumes: `pendingRedemptions`, `fulfilRedemption`, `cancelRedemption`, `setStock`, `clearStock`, `setHidden`, `allPrizeRows` (Task 4); `prizeById`, `PRIZE_WALL` (Task 3).
- Produces: `requireAdmin(): Promise<Session>` from `@/lib/auth` (throws unless admin). Note: `<AdminNav current="/admin/prizes" />` is referenced here and created in Task 9; if executing this task standalone, stub the import last or execute Tasks 8 and 9 together before typechecking.

- [ ] **Step 1: Add `requireAdmin` to `src/lib/auth.ts`**

Claims actions has this helper, and the five prize actions all need it, so it earns the shared name:

```ts
/** Server-side admin gate for actions: pages hide themselves, this is the wall. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user.isAdmin) throw new Error("admins only");
  return session;
}
```

In `src/app/admin/claims/actions.ts`, delete the local `requireAdmin` helper and import it from `@/lib/auth` instead (call sites stay identical). Leave `src/app/admin/flags/actions.ts` alone: it deliberately gates by returning `{ error }` instead of throwing (its header comment explains why), so it has no helper to replace.

- [ ] **Step 2: Create `src/app/admin/prizes/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  fulfilRedemption, cancelRedemption, setStock, clearStock, setHidden,
} from "@/lib/prizes-db";

type ActionState = { error: string } | null;

function failure(err: unknown, fallback: string): ActionState {
  return { error: err instanceof Error ? err.message : fallback };
}

export async function fulfilAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await fulfilRedemption(String(formData.get("playerId")), String(formData.get("redemptionId")));
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "fulfil failed");
  }
}

export async function cancelAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const note = String(formData.get("note") ?? "").trim();
  try {
    await cancelRedemption(
      String(formData.get("playerId")),
      String(formData.get("redemptionId")),
      note || undefined,
    );
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "cancel failed");
  }
}

export async function setStockAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const stock = Number(formData.get("stock"));
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a whole number, 0 or more." };
  try {
    await setStock(String(formData.get("prizeId")), stock);
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "stock update failed");
  }
}

export async function clearStockAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await clearStock(String(formData.get("prizeId")));
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "stock update failed");
  }
}

export async function toggleHiddenAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await setHidden(String(formData.get("prizeId")), formData.get("hidden") === "true");
    revalidatePath("/admin/prizes");
    return null;
  } catch (err) {
    return failure(err, "visibility update failed");
  }
}
```

- [ ] **Step 3: Create `src/app/admin/prizes/redemption-actions.tsx`**

```tsx
"use client";
import { useActionState } from "react";
import { fulfilAction, cancelAction } from "./actions";

export function RedemptionActions({ playerId, redemptionId }: { playerId: string; redemptionId: string }) {
  const [fulfilState, fulfilFormAction, fulfilPending] = useActionState(fulfilAction, null);
  const [cancelState, cancelFormAction, cancelPending] = useActionState(cancelAction, null);
  const busy = fulfilPending || cancelPending;
  return (
    <div className="mt-2">
      <span className="flex flex-wrap items-center gap-2">
        <form action={fulfilFormAction}>
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="redemptionId" value={redemptionId} />
          <button
            disabled={busy}
            className="cursor-pointer rounded-full bg-[var(--hot)] px-4 py-1.5 text-sm font-extrabold text-[var(--ink)] transition-transform hover:-rotate-2 disabled:cursor-not-allowed"
          >
            {fulfilPending ? "Fulfilling…" : "Fulfil"}
          </button>
        </form>
        <form action={cancelFormAction} className="flex items-center gap-2">
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="redemptionId" value={redemptionId} />
          <input
            name="note"
            placeholder="note (optional)"
            className="w-36 border-2 border-[color-mix(in_srgb,var(--ink)_30%,transparent)] px-2 py-1 text-sm font-extrabold"
          />
          <button
            disabled={busy}
            className="cursor-pointer px-1 text-sm font-extrabold underline transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed"
          >
            {cancelPending ? "Cancelling…" : "Cancel & refund"}
          </button>
        </form>
      </span>
      {(fulfilState?.error || cancelState?.error) && (
        <p className="mt-2 text-sm font-extrabold text-[color-mix(in_srgb,var(--hot)_70%,var(--ink))]">
          {fulfilState?.error || cancelState?.error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/admin/prizes/stock-editor.tsx`**

```tsx
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
```

- [ ] **Step 5: Create `src/app/admin/prizes/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { pendingRedemptions, allPrizeRows } from "@/lib/prizes-db";
import { prizeById } from "@/lib/prizes";
import { PRIZE_WALL } from "@/data/prize-wall";
import { StoreStyles } from "../../store-styles";
import { AdminNav } from "../admin-nav";
import { RedemptionActions } from "./redemption-actions";
import { StockEditor } from "./stock-editor";

export const dynamic = "force-dynamic";

export default async function AdminPrizesPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const [pending, rows] = await Promise.all([pendingRedemptions(), allPrizeRows()]);
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin/prizes" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Redemptions</h1>
          {pending.length === 0 && <p className="mt-4 font-extrabold">Queue&apos;s empty.</p>}
          <ul className="mt-4 space-y-5">
            {pending.map((r) => (
              <li
                key={r.redemptionId}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4"
              >
                <p className="font-extrabold">
                  {r.displayName}: {prizeById(r.prizeId)?.name ?? r.prizeId} (
                  {r.costAtRedemption.toLocaleString("en-US")} pts)
                </p>
                <p className="mt-1 text-sm font-extrabold text-[color-mix(in_srgb,var(--ink)_60%,transparent)]">
                  requested {r.requestedAt.slice(0, 10)}
                </p>
                <RedemptionActions playerId={r.playerId} redemptionId={r.redemptionId} />
              </li>
            ))}
          </ul>
        </div>
        <div className="tilt-r taped paper mt-8 p-8">
          <h2 className="display text-4xl">Stock</h2>
          <ul className="mt-4 space-y-5">
            {PRIZE_WALL.map((item) => (
              <li
                key={item.id}
                className="border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-4"
              >
                <p className="font-extrabold">{item.name}</p>
                <StockEditor
                  prizeId={item.id}
                  stock={rows.get(item.id)?.stock}
                  hidden={!!rows.get(item.id)?.hidden}
                />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck (with Task 9's AdminNav in place) and commit**

If Task 9 has not run yet, `npx tsc --noEmit` fails only on the missing `../admin-nav` import; proceed to Task 9 and typecheck there, or create the nav first. When clean:

```bash
git add src/lib/auth.ts src/app/admin/claims/actions.ts src/app/admin/flags/actions.ts src/app/admin/prizes
git commit -m "Add the admin prizes page: redemption queue and stock editor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Admin index, AdminNav, and the header link

**Files:**
- Create: `website/src/app/admin/page.tsx`
- Create: `website/src/app/admin/admin-nav.tsx`
- Modify: `website/src/app/admin/claims/page.tsx`, `website/src/app/admin/flags/page.tsx` (mount AdminNav)
- Modify: `website/src/app/site-chrome.tsx` (Your Card nav link)

**Interfaces:**
- Consumes: `listPendingClaims` (exists), `unresolvedFlags`/`clubDay` (exist), `pendingRedemptions` (Task 4).
- Produces: `AdminNav({ current }: { current: string })` server component.

- [ ] **Step 1: Create `src/app/admin/admin-nav.tsx`**

```tsx
import Link from "next/link";

const PAGES = [
  { label: "Overview", href: "/admin" },
  { label: "Claims", href: "/admin/claims" },
  { label: "Flags", href: "/admin/flags" },
  { label: "Prizes", href: "/admin/prizes" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
      {PAGES.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.href === current ? "page" : undefined}
          className={
            p.href === current
              ? "font-extrabold text-[var(--paper)] underline decoration-[var(--accent)] decoration-2 underline-offset-8"
              : "font-extrabold text-[color-mix(in_srgb,var(--paper)_80%,transparent)] transition-colors hover:text-[var(--accent)]"
          }
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPendingClaims } from "@/lib/accounts";
import { pendingRedemptions } from "@/lib/prizes-db";
import { unresolvedFlags } from "@/lib/pods-db";
import { clubDay } from "@/lib/pods";
import { StoreStyles } from "../store-styles";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

// Flags live on recent pods; a week of days covers any realistic dispute.
const LOOKBACK_DAYS = 7;

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const days = Array.from({ length: LOOKBACK_DAYS }, (_, i) =>
    clubDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000)));
  const [claims, redemptions, flags] = await Promise.all([
    listPendingClaims(), pendingRedemptions(), unresolvedFlags(days),
  ]);
  const sections = [
    { label: "Claims", href: "/admin/claims", pending: claims.length },
    { label: "Flags", href: "/admin/flags", pending: flags.length },
    { label: "Prizes", href: "/admin/prizes", pending: redemptions.length },
  ];
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <AdminNav current="/admin" />
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Back office</h1>
          <ul className="mt-4 space-y-4">
            {sections.map((s) => (
              <li
                key={s.href}
                className="flex items-center justify-between gap-4 border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-3"
              >
                <Link href={s.href} className="font-extrabold underline transition-colors hover:text-[var(--accent)]">
                  {s.label}
                </Link>
                <span className={`font-extrabold${s.pending === 0 ? " text-[color-mix(in_srgb,var(--ink)_50%,transparent)]" : ""}`}>
                  {s.pending === 0 ? "clear" : `${s.pending} pending`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Mount AdminNav on claims and flags**

In `src/app/admin/claims/page.tsx` and `src/app/admin/flags/page.tsx`: add `import { AdminNav } from "../admin-nav";` and insert `<AdminNav current="/admin/claims" />` (respectively `"/admin/flags"`) directly after the `<span className="tape">Shopkeeper only</span>` line.

- [ ] **Step 4: Add "Your Card" to the public header**

In `src/app/site-chrome.tsx`, extend `NAV`:

```ts
const NAV = [
  { label: "The Tables", href: "/play" },
  { label: "The Board", href: "/standings" },
  { label: "The Prize Wall", href: "/prizes" },
  // A static link on purpose: session-aware chrome would force every page
  // dynamic and kill the home page's prerender. /account sorts both states.
  { label: "Your Card", href: "/account" },
];
```

- [ ] **Step 5: Typecheck and run all tests**

```bash
npx tsc --noEmit && node --test src/lib/*.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin src/app/site-chrome.tsx
git commit -m "Add the admin overview, shared admin nav and Your Card link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Build, deploy, backfill, verify end to end

**Files:**
- Modify: `CLAUDE.md` (status note, after verification)

- [ ] **Step 1: Full local check**

Stop any running dev server first (`next build` and `next dev` share `.next`; building underneath a live server 500s every route). Then:

```bash
node --test src/lib/*.test.ts && npx sst shell --stage production -- npm run build
```

Expected: tests pass, build succeeds. (A bare `npm run build` dies with "SST links are not active"; the shell wrapper is required.)

- [ ] **Step 2: Deploy**

Check `git status` for another session's uncommitted work first; stop and ask if any. Then:

```bash
npx sst deploy --stage production > /tmp/deploy2.log 2>&1; echo "exit: $?"
```

Tables and secret already exist from Task 1, so this deploy should succeed first try; on a stale-lock error run `npx sst unlock --stage production` and retry.

- [ ] **Step 3: Run the launch backfill**

```bash
npx sst shell --stage production -- node scripts/backfill-linked.ts
```

Expected output: at least 1 linked account and a nonzero number of placement credits (Alex's account linked 2026-07-29 with 27 tournaments of history behind it). Re-running immediately must print `0 placement credit(s) written` (idempotency proof).

- [ ] **Step 4: Production verification (with Alex)**

This mirrors how pods were verified. Ask Alex to run through it, or drive it with him watching:

1. `/account`: balance shows the backfilled points; history empty.
2. `/prizes` signed out: wall renders, "Sign in to spend your points" nudge, no buttons.
3. `/prizes` signed in: balance line, Redeem on affordable items, "Not enough points yet" on the rest.
4. `/admin/prizes`: set stock 1 on one Regional playmat; wall still shows it; set a test stock of 1 on a cheap item if preferred for the next step.
5. Redeem a cheap item (e.g. Metal Damage Token, 275 pts): two-step confirm, success message, balance drops on `/prizes` and `/account`, history shows `pending`.
6. Webhook: the private admins channel got the ping with name, item, cost, link.
7. `/admin`: Prizes shows `1 pending`.
8. `/admin/prizes`: Cancel & refund with a note ("verification test"): points return (check `/account`), history shows `cancelled`, queue empties.
9. If a finite-stock item was redeemed: stock is back at its pre-redeem count.
10. Optional full-cycle: redeem again and Fulfil; history shows `fulfilled`; then leave it (a real 275-pt spend) or cancel it too and note the ledger shows the full audit trail.
11. Header shows "Your Card" on every page; `/admin` 404s in a signed-out or non-admin browser.

- [ ] **Step 5: Update `CLAUDE.md` status**

In the Status section, after the Stage 2 paragraph, add a short "Stage 3 shipped (prize wall redemption)" paragraph: `/prizes` is transactional, `/account` shows balance and history, `/admin` + `/admin/prizes` exist, `Prize` and `Redemption` tables live, placement reconciliation runs at approval + weekly cron, verified end to end in production with the date. Mention the spec path.

- [ ] **Step 6: Final commit**

```bash
git add CLAUDE.md
git commit -m "Record prize wall redemption ship in project status

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
