# Blue Milk Gaming

Monorepo for Blue Milk Gaming (BMG), a Star Wars: Unlimited (SWU) content org that runs a weekly tournament on melee.gg — the "Online Local", Sunday nights. First project: the org website in `website/`. Other projects may be added later (`packages/` reserved for shared code).

## Status

**Phase 1 complete.** The site is live at **https://bluemilkgaming.com** (stage `production`, `us-east-2`; apex cutover 2026-07-30, www redirects to apex). Billing alarms are set.

**Phase 2 in progress:** home page (roster of the four members, YouTube RSS content feed, tournament feed), tournaments page describing the Online Local, and the external Fourthwall shop link. Nothing in Phase 2 needs a database.

**Phase 3 data layer complete** (2026-07-29), built in parallel with Phase 2 since it shares no files. Three DynamoDB tables are live and backfilled with all 27 ended Online Locals: 27 tournaments, 407 placements, 149 players. A weekly cron syncs new results. **No leaderboard UI yet** — that waits on Phase 2's components and tokens.

**Stage 1 shipped:** Discord sign-in and the claim flow are live. `/account` links players to their melee results. `/admin/claims` (for admins only) shows the claim queue. The `Account` table is live. Verified end to end in production 2026-07-29 (sign-in, claim, approve, linked).

**Stage 2 shipped (pods):** `/play` runs 8-player, 3-round pods end to end; the home page has a live Tables section; `/admin/flags` resolves disputes. `Pod`, `PointsLedger` and `PlayerBalance` tables are live (ledger and balance get their first consumers here; pods pay currency only, best 2 pods per club day, 25 per win via `PODS_V1`). Discord webhook announces lobbies. Verified end to end in production 2026-07-30 (solo, using `scripts/pod-sim.ts` for synthetic opponents: join, launch, report, false-report → flag → resolve, payout, cleanup). Spec: `docs/superpowers/specs/2026-07-29-online-premier-pods-design.md`.

**Early pod launch shipped (2026-07-30):** the host (first seat) can launch with 4 or 6 players; a full 8 still deals itself. At 4 the existing rematch-penalty pairing is a round robin by construction, no special-casing. Discord announcements collapsed to one message per table, edited in place through filling/launched/finished/cleared (webhook `?wait=true` + PATCH; `announceMessageId` on the pod row). The opening post pings `@LFG` (`LfgRoleId` secret), rate-limited to one ping per hour via `shouldPingLfg` over `byDay`. Seats carry the Discord avatar hash (JWT → `ensureAccount` → seat; initial-letter fallback). Verified end to end in production 2026-07-30 (sim players: open+ping, edits, fire at 4, round robin, payouts, cooldown suppression, leave→cleared; cleaned up after). Spec: `docs/superpowers/specs/2026-07-30-early-pod-launch-design.md`.

**Stage 3 shipped (prize wall redemption):** `/prizes` is transactional (stock-aware wall, two-step redeem, conditional DynamoDB transaction per ADR 0004); `/account` shows the points balance and redemption history (with admin cancellation notes); `/admin` is a pending-counts index and `/admin/prizes` runs the queue (fulfil / cancel-and-refund) and the stock editor. `Prize` and `Redemption` tables are live; the `AdminWebhookUrl` secret pings a private admins channel on redemption. Tournament currency reaches balances via idempotent per-tournament reconciliation (`plc-<meleeId>` ledger entries) at claim approval, after the weekly sync, and via `scripts/backfill-linked.ts` (run at launch: 8 credits, 1800 pts). Verified end to end in production 2026-07-30 (redeem, webhook, cancel/refund, fulfil, stock, router-cache revalidation; test data cleaned up after). Spec: `docs/superpowers/specs/2026-07-30-prize-wall-redemption-design.md`.

Later phases: home page (Phase 2), leaderboard UI. Full plan at `~/.claude/plans/cheerful-snuggling-snowglobe.md`.

## Key docs

- `docs/org.md` — who we are, members, channels, tournament format, reach
- `docs/brand.md` — colors, fonts, logo inventory (canonical files in `assets/brand/`)
- `docs/setup.md` — AWS access, secrets, external accounts, deploy gotchas
- `docs/melee-api.md` — melee.gg endpoints, auth, response shapes, **PII constraints**, rate limits
- `docs/legacy-leaderboard-data.md` — why the old Google Sheets are not the import source
- `docs/reference/` — melee OpenAPI spec + tournament inventory (no player data)
- `docs/decisions/` — ADRs: **0001** stack · **0002** plan corrections · **0003** domain/DNS · **0004** data model

## Stack (ADR 0001)

- Next.js 15 App Router + TypeScript + Tailwind v4, in `website/`
- SST v4 → AWS via OpenNext (CloudFront + Lambda + S3); infra in `website/sst.config.ts`
- DynamoDB, several purpose-shaped tables on demand — **not** single-table design (ADR 0004). Three tables live: `Player`, `Tournament`, `Placement`. The other entities in ADR 0004 are deliberately not built; see its "What is actually built" table before adding one.
- Auth.js v5 + Discord OAuth; admin = Discord ID allowlist, enforced server-side
- Content feed: YouTube RSS (no API key) + Patreon link. **No Twitch** — see ADR 0002
- Results: imported from the **melee.gg API**, weekly cron. Players key on melee's account-level `UserIdentity` UUID — **not** the integer `ID` on a standings row, which is a per-tournament registration ID, and not `Username`, which players may change every 28 days. See `docs/melee-api.md`. The Google Sheets exports are a reconciliation reference only, not an import path.

## Domain

`bluemilkgaming.com` is owned, DNS at Cloudflare. The Fourthwall store moved to `merch.bluemilkgaming.com` (2026-07-30, via Fourthwall's Entri auto-setup; `merch.` not `shop.` to match the nav label). **Apex cutover done 2026-07-30**: `sst.config.ts` has the `domain` block (apex + www redirect, `sst.cloudflare.dns()`), so every deploy needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_DEFAULT_ACCOUNT_ID` in `website/.env` (gitignored; `.env.local` is Next-only and `sst deploy` won't read it). The raw CloudFront URL no longer serves the site. Public-folder directory names must not shadow page routes: OpenNext routes public prefixes to S3, which is why prize images live in `public/prize-images/`, not `public/prizes/`.

## Commands (run in `website/`)

- `npm run dev` — local dev server (wraps `sst shell --stage production`, so it needs AWS credentials; the home page reads the production leaderboard tables at request time)
- `npm run build` — production build. Run locally as `npx sst shell --stage production -- npm run build`: the home page prerenders from the leaderboard tables, so a bare build dies with "SST links are not active". Deploys handle this themselves.
- `npx sst deploy --stage production` — deploy
- `npx sst secret set <Name> "<value>" --stage production` — set a deployed secret
- `npx sst unlock --stage production` — clear a stale lock after a crashed deploy
- `node --test src/lib/*.test.ts` — run the unit tests (node's built-in runner, no framework)
- `npx sst shell --stage production -- node --env-file=.env.local scripts/melee-import.ts` — manual import; add `--force` to re-import, or melee tournament IDs to limit scope. Note the `--` before `node`.
- `npx sst shell --stage production -- node --env-file=.env.local scripts/melee-dryrun.ts` — read-only melee probe, writes nothing, prints only non-PII fields

## Conventions

- Default branch `main`; commit at phase checkpoints.
- Pin exact versions for `next` and `sst` (OpenNext compatibility; Auth.js v5 churn).
- Avoid edge-runtime-only Next.js features (OpenNext target).
- Cost discipline: everything must be free-tier/scale-to-zero.
- Don't use the bare "BMG" acronym in outward-facing copy; spell out Blue Milk Gaming.
- **Never mention Karabast** in site copy, code comments, commits, or any public-facing text. Games are played there, but the devs are cautious about Disney attention and we won't be the ones who point a spotlight at them. Say "play your match however your pod prefers" or point at Discord for coordination.
- No em dashes in public-facing copy. Rewrite with commas, periods, or colons. (Code comments are exempt.)
- Secrets live in `website/.env.local` (local) and SST secrets (deployed). Never commit real values; `website/.env.example` is the template.
- **melee.gg responses contain player PII.** Standings carry real names, Discord usernames, DCI numbers and pronouns; `/api/player/list` adds `Email`, `WizardsAccountEmail`, `PlayerName` and `Bio`. Only `UserIdentity`, registration ID, display name and result cross the boundary, and the strip lives in `src/lib/melee.ts` so no caller can bypass it. Never log or commit raw responses. Never render more than a display name publicly — note many players set their display name to their real name, and publishing that is fine; the rule is about which *field* is used, not how the value looks.

## Gotchas that have already bitten

- **Fonts:** the Tailwind block referencing `--font-hubot-sans` must be `@theme inline`. A plain `@theme` flattens it at build time and the font silently falls back to system sans.
- **Images:** `images.unoptimized` is set — OpenNext's optimizer Lambda 500s against Next 15.5. Nothing resizes at request time, so **size images before committing** them to `public/brand/`.
- **Logo SVGs:** the wordmark SVGs store text as live `<text>` needing Hubot Sans, so they collapse into overlapping glyphs via `<img>`. Use the PNG lockups. `icon.svg` is pure paths and safe.
- **First deploy on a new machine** downloads a ~176 MB Pulumi provider and can time out; see `docs/setup.md`.
- **Adding a linked SST resource always fails the first deploy.** SST writes `sst-env.d.ts` while the Next build is already typechecking against it, so the build dies on `Property 'X' does not exist on type 'Resource'`. Just re-run the deploy. This is not a one-time thing — it recurs for every new resource or secret.
- **`removal: "retain"` means a primary-key change orphans the old table.** Pulumi replaces create-before-delete, and retain keeps the old one, so you end up with two tables and SST managing only the new one. Delete the orphan by hand after confirming which is live. Get the live name from SST, never by grepping `list-tables` — the names differ only by a random suffix.
- **Don't pipe `sst deploy` into `tail`/`grep`.** You get the pipe's exit code, so a failed deploy reads as success. Redirect to a file and echo `$?`.
- **Node runs these `.ts` files in strip-only mode**, so TypeScript that needs real transformation is a runtime error even though `tsc` passes. Constructor parameter properties (`constructor(readonly x: number)`) are the one that has already bitten; use a plain field assignment.
- **A production build clobbers a running dev server.** `next build` and `next dev` share `.next`, so building while the dev server runs leaves the server holding dead manifest paths and every route 500s with `_buildManifest.js.tmp` ENOENT. Stop the dev server before any local build, then recover with the stop → delete `.next` → restart sequence below.
- **A stale browser tab wedges `next dev`.** If a tab holding a page from a dead dev-server instance reconnects to a new one, Next 15.5 (turbopack) spirals into `_buildManifest.js.tmp` ENOENT errors and every route 500s, even after `rm -rf .next`. The fix is the order: stop the server, delete `.next`, start it, then hard-reload the tab before anything else polls. Symptom to recognize: curl says 200 while the browser says Internal Server Error, then everything 500s.
