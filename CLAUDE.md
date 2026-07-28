# Blue Milk Gaming

Monorepo for Blue Milk Gaming (BMG), a Star Wars: Unlimited (SWU) content org that runs a weekly tournament on melee.gg — the "Online Local", Sunday nights. First project: the org website in `website/`. Other projects may be added later (`packages/` reserved for shared code).

## Status

**Phase 1 complete.** The site is live at **https://d3fdgelj2nhbqw.cloudfront.net** (stage `production`, `us-east-2`) serving a branded placeholder page. Billing alarms are set. The custom domain is not cut over yet.

**Phase 2 is next:** home page (roster of the four members, YouTube RSS content feed, tournament feed), tournaments page describing the Online Local, and the external Fourthwall shop link. Nothing in Phase 2 needs a database.

Later phases: leaderboard from melee.gg data, Discord auth, prize wall, scheduled sync. Full plan at `~/.claude/plans/cheerful-snuggling-snowglobe.md`.

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
- DynamoDB, several purpose-shaped tables on demand — **not** single-table design (ADR 0004). No tables created yet.
- Auth.js v5 + Discord OAuth; admin = Discord ID allowlist, enforced server-side
- Content feed: YouTube RSS (no API key) + Patreon link. **No Twitch** — see ADR 0002
- Results: imported from the **melee.gg API** (stable player IDs, weekly cron). The Google Sheets exports are a reconciliation reference only, not an import path.

## Domain

`bluemilkgaming.com` is owned, DNS at Cloudflare, and currently serves the Fourthwall store. Per ADR 0003 the site takes the apex and the store moves to `shop.`. **Cutover has not started** — the store must be working at `shop.` first. Until then, deploys are only reachable at the CloudFront URL, and `sst.config.ts` deliberately has no `domain` block.

## Commands (run in `website/`)

- `npm run dev` — local dev server
- `npm run build` — production build
- `npx sst deploy --stage production` — deploy
- `npx sst secret set <Name> "<value>" --stage production` — set a deployed secret
- `npx sst unlock --stage production` — clear a stale lock after a crashed deploy

## Conventions

- Default branch `main`; commit at phase checkpoints.
- Pin exact versions for `next` and `sst` (OpenNext compatibility; Auth.js v5 churn).
- Avoid edge-runtime-only Next.js features (OpenNext target).
- Cost discipline: everything must be free-tier/scale-to-zero.
- Don't use the bare "BMG" acronym in outward-facing copy; spell out Blue Milk Gaming.
- No em dashes in public-facing copy. Rewrite with commas, periods, or colons. (Code comments are exempt.)
- Secrets live in `website/.env.local` (local) and SST secrets (deployed). Never commit real values; `website/.env.example` is the template.
- **melee.gg standings responses contain player PII** (real names, Discord usernames, DCI numbers, pronouns). Drop everything except melee player ID, display name, and result at the ingest boundary; never log or commit raw responses; never render more than a display name publicly.

## Gotchas that have already bitten

- **Fonts:** the Tailwind block referencing `--font-hubot-sans` must be `@theme inline`. A plain `@theme` flattens it at build time and the font silently falls back to system sans.
- **Images:** `images.unoptimized` is set — OpenNext's optimizer Lambda 500s against Next 15.5. Nothing resizes at request time, so **size images before committing** them to `public/brand/`.
- **Logo SVGs:** the wordmark SVGs store text as live `<text>` needing Hubot Sans, so they collapse into overlapping glyphs via `<img>`. Use the PNG lockups. `icon.svg` is pure paths and safe.
- **First deploy on a new machine** downloads a ~176 MB Pulumi provider and can time out; see `docs/setup.md`.
