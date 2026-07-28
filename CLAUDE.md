# Blue Milk Gaming

Monorepo for Blue Milk Gaming (BMG), a Star Wars: Unlimited (SWU) content org that runs a weekly tournament on melee.gg — the "Online Local", Sunday nights. First project: the org website in `website/`. Other projects may be added later (`packages/` reserved for shared code).

## Key docs

- `docs/org.md` — who we are, channels, tournament format, reach
- `docs/brand.md` — colors, fonts, logo inventory (canonical files in `assets/brand/`)
- `docs/setup.md` — AWS access, secrets handling, external accounts, domain decision
- `docs/decisions/` — ADRs; 0001 is the stack, 0002 corrects V1 plan assumptions
- V1 plan: home (roster, content feed, tournament feed), tournaments page, leaderboard (auto-updated from melee.gg), prize wall (Discord-login redemptions), external Fourthwall shop link

## Stack (see ADR 0001)

- Next.js 15 App Router + TypeScript + Tailwind v4, in `website/`
- SST v4 → AWS via OpenNext (CloudFront + Lambda + S3); infra in `website/sst.config.ts`
- DynamoDB (provisional — schema gated on reconciling owner's data-model draft)
- Auth.js v5 + Discord OAuth; admin = Discord ID allowlist, enforced server-side
- Content feed: YouTube RSS (no API key) + Patreon link. **No Twitch** — see ADR 0002
- Results importer: `ResultsProvider` interface — CSV (Google Sheets) now, melee.gg API later; idempotent ingest, append-only points ledger

## Commands (run in `website/`)

- `npm run dev` — local dev server
- `npm run build` — production build
- `npx sst deploy --stage production` — deploy
- `npx sst secret set <Name> "<value>" --stage production` — set a deployed secret

## Conventions

- Default branch `main`; commit at phase checkpoints.
- Pin exact versions for `next` and `sst` (OpenNext compatibility; Auth.js v5 churn).
- Avoid edge-runtime-only Next.js features (OpenNext target); no Lambda image optimization at this scale.
- Cost discipline: everything must be free-tier/scale-to-zero; billing alarm before first deploy.
- Don't use the bare "BMG" acronym in outward-facing copy — spell out Blue Milk Gaming.
- Secrets live in `website/.env.local` (local) and SST secrets (deployed). Never commit real values; `website/.env.example` is the template.
- Brand gotchas that will bite: the Tailwind block referencing the font variable must be `@theme inline`, and the wordmark SVGs contain live text so they can't be used via `<img>`. Both documented in `docs/brand.md`.
