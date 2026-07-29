# Discord Identity (Pods Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players sign in with Discord and can claim their melee.gg identity (admin-approved), so pod points and Sunday results land on one person.

**Architecture:** Auth.js v5 (JWT sessions, no adapter) + a new `Account` DynamoDB table keyed on the Discord snowflake. A claim is a pointer: `Account.meleeUserIdentity` set on admin approval. Nothing is ever re-keyed; the existing `Player`/`Placement` tables are untouched. Spec: `docs/superpowers/specs/2026-07-29-online-premier-pods-design.md` (Staging section).

**Tech Stack:** next-auth@5 (Auth.js), SST v4 Dynamo + Secret, Next 15 App Router server actions, `node --test` for pure logic.

## Global Constraints

- Never mention Karabast in copy, comments, or commits (CLAUDE.md).
- No em dashes in public-facing copy; spell out "Blue Milk Gaming", never bare "BMG" (CLAUDE.md).
- Pin exact versions for new runtime deps (CLAUDE.md: next/sst churn rule applies to auth too).
- No edge-runtime-only features; everything must run on OpenNext Lambda (CLAUDE.md).
- PII: display names only in any UI (CLAUDE.md).
- Adding SST resources fails the *first* deploy with a type error on `Resource.X`; re-run the deploy, it is not a real failure (CLAUDE.md gotcha).
- All commands run in `website/`. Tests: `node --test src/lib/*.test.ts`.

## Deploy & external setup (owner does once, before Task 1 verify)

1. Discord app at https://discord.com/developers/applications → OAuth2 → redirect URLs: `http://localhost:3000/api/auth/callback/discord` and `https://d3fdgelj2nhbqw.cloudfront.net/api/auth/callback/discord`.
2. Secrets (from `website/`):
   ```bash
   npx sst secret set DiscordClientId "..." --stage production
   npx sst secret set DiscordClientSecret "..." --stage production
   npx sst secret set AuthSecret "$(openssl rand -base64 33)" --stage production
   npx sst secret set AdminDiscordIds "<your-discord-user-id>" --stage production
   ```
3. Fill the matching vars in `.env.local` (template updated in Task 1).

---

### Task 1: Discord sign-in

**Files:**
- Modify: `sst.config.ts` (4 secrets, link to `Web`)
- Create: `src/lib/auth.ts`
- Create: `src/lib/admins.ts`, Test: `src/lib/admins.test.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `.env.example`, `package.json`

**Interfaces:**
- Produces: `auth()` from `src/lib/auth.ts` returning `Session | null` where `session.user = { discordUserId: string, name: string, isAdmin: boolean }`; `signIn`, `signOut` server actions re-exported from the same file. `parseAdminIds(raw: string): Set<string>` from `src/lib/admins.ts`.

- [ ] **Step 1: Install next-auth v5, exact version**

```bash
npm install --save-exact next-auth@5.0.0
```

If npm reports no stable `5.0.0`, install the current published v5 line (`npm view next-auth versions` and pick the newest `5.x`, or `next-auth@beta` if v5 is still tagged beta) — still `--save-exact`.

- [ ] **Step 2: Write the failing test for the allowlist parser**

`src/lib/admins.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminIds } from "./admins.ts";

test("parses comma-separated ids, trimming blanks", () => {
  assert.deepEqual([...parseAdminIds("123, 456 ,,789")], ["123", "456", "789"]);
});

test("empty string means no admins", () => {
  assert.equal(parseAdminIds("").size, 0);
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `node --test src/lib/admins.test.ts`
Expected: FAIL (cannot find module `./admins.ts`)

- [ ] **Step 4: Implement `src/lib/admins.ts`**

```ts
/** Comma-separated Discord user IDs from the AdminDiscordIds secret. */
export function parseAdminIds(raw: string): Set<string> {
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `node --test src/lib/admins.test.ts` — Expected: PASS (2 tests)

- [ ] **Step 6: Add secrets in `sst.config.ts`**

Insert after the melee secrets block, and add the new secrets to the `Web` link array:

```ts
    // Discord OAuth + session signing (Stage 1 of the pods spec).
    const discordClientId = new sst.Secret("DiscordClientId");
    const discordClientSecret = new sst.Secret("DiscordClientSecret");
    const authSecret = new sst.Secret("AuthSecret");
    const adminDiscordIds = new sst.Secret("AdminDiscordIds");
```

```ts
    new sst.aws.Nextjs("Web", {
      link: [player, tournament, placement,
             discordClientId, discordClientSecret, authSecret, adminDiscordIds],
    });
```

- [ ] **Step 7: Create `src/lib/auth.ts`**

```ts
// Auth.js v5. JWT sessions, no adapter (ADR 0001): the session carries the
// Discord snowflake, which is the durable identity everything else keys on.
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { Resource } from "sst";
import { parseAdminIds } from "./admins.ts";

declare module "next-auth" {
  interface Session {
    user: { discordUserId: string; name: string; isAdmin: boolean };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: Resource.AuthSecret.value,
  trustHost: true, // behind CloudFront the Host header is not the Lambda's own
  providers: [
    Discord({
      clientId: Resource.DiscordClientId.value,
      clientSecret: Resource.DiscordClientSecret.value,
      // identify only: username + id. No email scope; we have no use for it.
      authorization: { params: { scope: "identify" } },
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.discordUserId = String(profile.id);
        token.name = String(profile.global_name ?? profile.username);
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        discordUserId: token.discordUserId as string,
        name: token.name as string,
        isAdmin: parseAdminIds(Resource.AdminDiscordIds.value).has(
          token.discordUserId as string,
        ),
      };
      return session;
    },
  },
});
```

- [ ] **Step 8: Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 9: Update `.env.example`**

Replace the Discord/Auth placeholder block with:

```bash
# Discord OAuth (Stage 1). Local values from the Discord app's OAuth2 tab.
# Deployed values are SST secrets: DiscordClientId, DiscordClientSecret,
# AuthSecret, AdminDiscordIds.
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
# npx auth secret, or: openssl rand -base64 33
AUTH_SECRET=
# Comma-separated Discord user IDs allowed into /admin
ADMIN_DISCORD_IDS=
```

- [ ] **Step 10: Verify sign-in locally**

Run: `npm run dev`, open `http://localhost:3000/api/auth/signin`, complete the Discord flow, then `curl -s http://localhost:3000/api/auth/session` (with the browser's cookie) or check the signed-in page shows your Discord name.
Expected: session JSON contains `discordUserId` and `isAdmin: true` for the ID listed in `ADMIN_DISCORD_IDS`.
Note: `npm run dev` wraps `sst shell`, so `Resource.*` resolves locally; the four secrets must be set for the production stage first (see Deploy & external setup).

- [ ] **Step 11: Lint, build, commit**

```bash
npm run lint && npm run build
git add -A && git commit -m "Add Discord sign-in via Auth.js v5"
```

---

### Task 2: Account table and claim storage

**Files:**
- Modify: `sst.config.ts` (Account table, linked to `Web`)
- Create: `src/lib/accounts.ts`, Test: `src/lib/accounts.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (pure storage layer).
- Produces, from `src/lib/accounts.ts`:
  - `type AccountRow = { discordUserId: string; displayName: string; meleeUserIdentity?: string; pendingClaim?: string; createdAt: string }`
  - `ensureAccount(discordUserId: string, displayName: string): Promise<AccountRow>`
  - `getAccount(discordUserId: string): Promise<AccountRow | undefined>`
  - `requestClaim(discordUserId: string, meleeUserIdentity: string): Promise<void>`
  - `listPendingClaims(): Promise<AccountRow[]>`
  - `resolveClaim(discordUserId: string, approve: boolean): Promise<void>`
  - `claimError(account: AccountRow | undefined, taken: Set<string>, meleeUserIdentity: string): string | null` (pure)

- [ ] **Step 1: Add the table in `sst.config.ts`**

After the `placement` table:

```ts
    // Discord-side identity (pods spec, Stage 1). Keyed on the snowflake; a
    // claim links it to a Player by setting meleeUserIdentity. Nothing re-keys.
    const account = new sst.aws.Dynamo("Account", {
      fields: { discordUserId: "string" },
      primaryIndex: { hashKey: "discordUserId" },
    });
```

Add `account` to the `Web` link array.

- [ ] **Step 2: Write the failing test for claim eligibility**

`src/lib/accounts.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { claimError, type AccountRow } from "./accounts.ts";

const acct = (over: Partial<AccountRow> = {}): AccountRow => ({
  discordUserId: "d1",
  displayName: "Player One",
  createdAt: "2026-07-29T00:00:00Z",
  ...over,
});

test("fresh account may claim an unclaimed identity", () => {
  assert.equal(claimError(acct(), new Set(), "m-uuid-1"), null);
});

test("no account row yet is fine (created on demand)", () => {
  assert.equal(claimError(undefined, new Set(), "m-uuid-1"), null);
});

test("already linked accounts cannot claim again", () => {
  assert.match(claimError(acct({ meleeUserIdentity: "m0" }), new Set(), "m1")!, /already linked/);
});

test("an identity claimed by someone else is taken", () => {
  assert.match(claimError(acct(), new Set(["m1"]), "m1")!, /taken/);
});

test("a pending claim blocks a second request", () => {
  assert.match(claimError(acct({ pendingClaim: "m2" }), new Set(), "m1")!, /pending/);
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `node --test src/lib/accounts.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 4: Implement `src/lib/accounts.ts`**

```ts
// Discord-side accounts and the melee claim flow (pods spec, Stage 1).
// An account is created at first need, claims go to a queue, and admin
// approval sets the pointer. The Player table is never modified.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const TABLE = () => Resource.Account.name;

export type AccountRow = {
  discordUserId: string;
  displayName: string;
  meleeUserIdentity?: string;
  pendingClaim?: string;
  createdAt: string;
};

/** Why this claim is not allowed, or null if it is. Pure; caller supplies state. */
export function claimError(
  account: AccountRow | undefined,
  taken: Set<string>,
  meleeUserIdentity: string,
): string | null {
  if (account?.meleeUserIdentity) return "This account is already linked to a melee name.";
  if (account?.pendingClaim) return "You already have a claim pending review.";
  if (taken.has(meleeUserIdentity)) return "That melee name is taken by another account.";
  return null;
}

export async function getAccount(discordUserId: string): Promise<AccountRow | undefined> {
  const res = await doc.send(new GetCommand({ TableName: TABLE(), Key: { discordUserId } }));
  return res.Item as AccountRow | undefined;
}

export async function ensureAccount(discordUserId: string, displayName: string): Promise<AccountRow> {
  const res = await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    // Refresh the Discord display name on every touch; set createdAt once.
    UpdateExpression: "SET displayName = :n, createdAt = if_not_exists(createdAt, :now)",
    ExpressionAttributeValues: { ":n": displayName, ":now": new Date().toISOString() },
    ReturnValues: "ALL_NEW",
  }));
  return res.Attributes as AccountRow;
}

// ponytail: full-table Scans below. Accounts number in the dozens; a GSI on
// meleeUserIdentity and a pendingClaim sparse index are the upgrade if the
// club somehow reaches thousands.
async function allAccounts(): Promise<AccountRow[]> {
  const res = await doc.send(new ScanCommand({ TableName: TABLE() }));
  return (res.Items ?? []) as AccountRow[];
}

export async function requestClaim(discordUserId: string, meleeUserIdentity: string): Promise<void> {
  const [account, accounts] = await Promise.all([getAccount(discordUserId), allAccounts()]);
  const taken = new Set(
    accounts.flatMap((a) => (a.meleeUserIdentity ? [a.meleeUserIdentity] : [])),
  );
  const error = claimError(account, taken, meleeUserIdentity);
  if (error) throw new Error(error);
  await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    UpdateExpression: "SET pendingClaim = :m",
    // Guards the race where two tabs submit at once.
    ConditionExpression: "attribute_not_exists(pendingClaim) AND attribute_not_exists(meleeUserIdentity)",
    ExpressionAttributeValues: { ":m": meleeUserIdentity },
  }));
}

export async function listPendingClaims(): Promise<AccountRow[]> {
  return (await allAccounts()).filter((a) => a.pendingClaim);
}

export async function resolveClaim(discordUserId: string, approve: boolean): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: TABLE(),
    Key: { discordUserId },
    UpdateExpression: approve
      ? "SET meleeUserIdentity = pendingClaim REMOVE pendingClaim"
      : "REMOVE pendingClaim",
    ConditionExpression: "attribute_exists(pendingClaim)",
  }));
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `node --test src/lib/accounts.test.ts` — Expected: PASS (5 tests)
Then the full suite: `node --test src/lib/*.test.ts` — Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add Account table and melee claim storage"
```

---

### Task 3: Account page with the claim flow

**Files:**
- Create: `src/app/account/page.tsx`
- Create: `src/app/account/actions.ts`

**Interfaces:**
- Consumes: `auth`, `signIn`, `signOut` (Task 1); `ensureAccount`, `getAccount`, `requestClaim` (Task 2); `getLeaderboard("all-time")` from `src/lib/db.ts` (existing) for the pick-your-name list.
- Produces: `/account` route. Store-styled via existing `StoreStyles` + `paper`/`tape`/`tilt-*` classes from `src/app/store-styles.tsx`.

- [ ] **Step 1: Create `src/app/account/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/lib/auth";
import { requestClaim } from "@/lib/accounts";

export async function signInAction() {
  await signIn("discord", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function claimAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("sign in first");
  const meleeUserIdentity = String(formData.get("meleeUserIdentity") ?? "");
  if (!meleeUserIdentity) throw new Error("pick a name from the list");
  await requestClaim(session.user.discordUserId, meleeUserIdentity);
  revalidatePath("/account");
}
```

- [ ] **Step 2: Create `src/app/account/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { ensureAccount } from "@/lib/accounts";
import { getLeaderboard } from "@/lib/db";
import { StoreStyles } from "../store-styles";
import { signInAction, signOutAction, claimAction } from "./actions";

export const dynamic = "force-dynamic"; // session-dependent, never prerender

export default async function AccountPage() {
  const session = await auth();
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Your card</span>
        {session ? <SignedIn name={session.user.name} discordUserId={session.user.discordUserId} /> : <SignedOut />}
      </main>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="tilt-l taped paper mt-8 p-8">
      <h1 className="display text-4xl">Sign in</h1>
      <p className="mt-4 leading-relaxed text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
        Sign in with Discord to link your melee.gg results and, soon, pull up a
        chair at the tables.
      </p>
      <form action={signInAction}>
        <button className="mt-6 rounded-full bg-[var(--hot)] px-6 py-3 font-extrabold text-[var(--ink)]">
          Sign in with Discord
        </button>
      </form>
    </div>
  );
}

async function SignedIn({ name, discordUserId }: { name: string; discordUserId: string }) {
  const account = await ensureAccount(discordUserId, name);
  return (
    <div className="tilt-l taped paper mt-8 p-8">
      <h1 className="display text-4xl">{name}</h1>
      {account.meleeUserIdentity ? (
        <p className="mt-4 font-extrabold">Linked to your melee results. You&apos;re all set.</p>
      ) : account.pendingClaim ? (
        <p className="mt-4 font-extrabold">Claim submitted. It counts once the shopkeeper checks the list.</p>
      ) : (
        <ClaimForm />
      )}
      <form action={signOutAction}>
        <button className="mt-8 text-sm font-extrabold underline">Sign out</button>
      </form>
    </div>
  );
}

async function ClaimForm() {
  const players = await getLeaderboard("all-time");
  return (
    <form action={claimAction} className="mt-4">
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
    </form>
  );
}
```

- [ ] **Step 3: Verify in dev**

Run: `npm run dev`. Visit `/account`: sign in, claim a name, reload.
Expected: signed-out card → Discord flow → claim picker listing real leaderboard names → after claiming, the pending message. A second claim attempt from another browser for the same name fails with "taken" once the first is approved (verifiable after Task 4).

- [ ] **Step 4: Lint, build, commit**

```bash
npm run lint && npm run build
git add -A && git commit -m "Add /account with Discord sign-in and melee claim flow"
```

---

### Task 4: Admin claims queue

**Files:**
- Create: `src/app/admin/claims/page.tsx`
- Create: `src/app/admin/claims/actions.ts`
- Modify: `CLAUDE.md` (status: Stage 1 shipped), `docs/setup.md` (Discord app setup, new secrets)

**Interfaces:**
- Consumes: `auth` (Task 1); `listPendingClaims`, `resolveClaim` (Task 2); player names via `getLeaderboard("all-time")` (existing).

- [ ] **Step 1: Create `src/app/admin/claims/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { resolveClaim } from "@/lib/accounts";

async function requireAdmin() {
  const session = await auth();
  // Server-side gate (CLAUDE.md): the page hides itself too, but this is the wall.
  if (!session?.user.isAdmin) throw new Error("admins only");
}

export async function approveAction(formData: FormData) {
  await requireAdmin();
  await resolveClaim(String(formData.get("discordUserId")), true);
  revalidatePath("/admin/claims");
}

export async function rejectAction(formData: FormData) {
  await requireAdmin();
  await resolveClaim(String(formData.get("discordUserId")), false);
  revalidatePath("/admin/claims");
}
```

- [ ] **Step 2: Create `src/app/admin/claims/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPendingClaims } from "@/lib/accounts";
import { getLeaderboard } from "@/lib/db";
import { StoreStyles } from "../../store-styles";
import { approveAction, rejectAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClaimsPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound(); // invisible to non-admins
  const [pending, players] = await Promise.all([listPendingClaims(), getLeaderboard("all-time")]);
  const nameOf = new Map(players.map((p) => [p.meleeUserIdentity, p.displayName]));
  return (
    <div className="store min-h-screen">
      <StoreStyles />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <span className="tape">Shopkeeper only</span>
        <div className="tilt-l taped paper mt-8 p-8">
          <h1 className="display text-4xl">Claims</h1>
          {pending.length === 0 && <p className="mt-4 font-extrabold">Queue&apos;s empty.</p>}
          <ul className="mt-4 space-y-4">
            {pending.map((a) => (
              <li key={a.discordUserId} className="flex items-center justify-between gap-4 border-b-2 border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pb-3">
                <span className="font-extrabold">
                  {a.displayName} → {nameOf.get(a.pendingClaim!) ?? a.pendingClaim}
                </span>
                <span className="flex gap-2">
                  <form action={approveAction}>
                    <input type="hidden" name="discordUserId" value={a.discordUserId} />
                    <button className="rounded-full bg-[var(--hot)] px-4 py-1.5 text-sm font-extrabold text-[var(--ink)]">Approve</button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="discordUserId" value={a.discordUserId} />
                    <button className="px-2 text-sm font-extrabold underline">Reject</button>
                  </form>
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

- [ ] **Step 3: Verify the gate and the flow in dev**

Run: `npm run dev`.
Expected: signed out or non-admin → `/admin/claims` is a 404. As admin: the claim made in Task 3 appears; Approve links it (the `/account` page now shows "Linked"); Reject clears it.

- [ ] **Step 4: Update docs**

`docs/setup.md`: add the Discord application steps and the four new secrets to the secrets list. `CLAUDE.md` status section: note Discord sign-in + claim flow are live, `/admin/claims` exists, `Account` table added.

- [ ] **Step 5: Lint, build, full test suite, commit**

```bash
npm run lint && npm run build && node --test src/lib/*.test.ts
git add -A && git commit -m "Add admin claims queue; document Stage 1 setup"
```

---

### Task 5: Deploy Stage 1

- [ ] **Step 1: Confirm the four secrets are set** (Deploy & external setup above): `npx sst secret list --stage production` shows `DiscordClientId`, `DiscordClientSecret`, `AuthSecret`, `AdminDiscordIds`.
- [ ] **Step 2: Deploy** — `npx sst deploy --stage production > /tmp/deploy.log 2>&1; echo $?` (never pipe to tail/grep, CLAUDE.md). The first run may fail on `Resource.Account`/new secrets typing; re-run once.
- [ ] **Step 3: Verify in production** — sign in at the CloudFront URL, submit a claim, approve it at `/admin/claims`, confirm `/account` shows Linked. Confirm the Discord app has the production callback URL.
- [ ] **Step 4: Commit any doc/status touch-ups** — `git add -A && git commit -m "Stage 1 live"`
