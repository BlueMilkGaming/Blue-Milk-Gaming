# Blue Milk Gaming

Monorepo for Blue Milk Gaming (BMG), a Star Wars: Unlimited (SWU) content org that runs a weekly tournament on melee.gg — the "Online Local", Sunday nights. First project: the org website in `website/`. Other projects may be added later (`packages/` reserved for shared code).

## Status

**Phase 1 complete.** The site is live at **https://d3fdgelj2nhbqw.cloudfront.net** (stage `production`, `us-east-2`) serving a branded placeholder page. Billing alarms are set. The custom domain is not cut over yet.

**Phase 2 in progress:** home page (roster of the four members, YouTube RSS content feed, tournament feed), tournaments page describing the Online Local, and the external Fourthwall shop link. Nothing in Phase 2 needs a database.

**Phase 3 data layer complete** (2026-07-29), built in parallel with Phase 2 since it shares no files. Three DynamoDB tables are live and backfilled with all 27 ended Online Locals: 27 tournaments, 407 placements, 149 players. A weekly cron syncs new results. **No leaderboard UI yet** — that waits on Phase 2's components and tokens.

Later phases: leaderboard UI, Discord auth, prize wall. Full plan at `~/.claude/plans/cheerful-snuggling-snowglobe.md`.

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

`bluemilkgaming.com` is owned, DNS at Cloudflare, and currently serves the Fourthwall store. Per ADR 0003 the site takes the apex and the store moves to `shop.`. **Cutover has not started** — the store must be working at `shop.` first. Until then, deploys are only reachable at the CloudFront URL, and `sst.config.ts` deliberately has no `domain` block.

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
