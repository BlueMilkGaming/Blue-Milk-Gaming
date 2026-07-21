# Blue Milk Gaming

Monorepo for Blue Milk Gaming (BMG), a gaming team/organization that runs weekly tournaments on melee.gg (the "Online Local", Sunday nights). First project: the org website in `website/`. Other projects may be added later (`packages/` reserved for shared code).

## Key docs

- `docs/brand.md` — brand colors, fonts, logo usage (canonical files in `assets/brand/`)
- `docs/org.md` — org context and background
- `docs/decisions/` — ADRs; see 0001 for the stack decision
- V1 plan: home (roster, content feed, tournament feed), tournaments page, leaderboard (auto-updated from melee.gg), prize wall (Discord-login redemptions), external Fourth Wall shop link

## Stack (see ADR 0001)

- Next.js 15 App Router + TypeScript + Tailwind v4, in `website/`
- SST v4 → AWS via OpenNext (CloudFront + Lambda + S3); infra in `website/sst.config.ts`
- DynamoDB (provisional — schema gated on reconciling owner's data-model draft)
- Auth.js v5 + Discord OAuth; admin = Discord ID allowlist, enforced server-side
- Results importer: `ResultsProvider` interface — CSV (Google Sheets) now, melee.gg API later; idempotent ingest, append-only points ledger

## Commands (run in `website/`)

- `npm run dev` — local dev server
- `npm run build` — production build
- `npx sst dev` — dev with AWS resources linked
- `npx sst deploy --stage production` — deploy

## Conventions

- Paths contain spaces (`Workspace/BMG Website/Blue Milk Gaming`) — always quote in shell commands.
- Default branch `main`; commit at phase checkpoints.
- Pin exact versions for `next` and `sst` (OpenNext compatibility; Auth.js v5 churn).
- Avoid edge-runtime-only Next.js features (OpenNext target); no Lambda image optimization at this scale.
- Cost discipline: everything must be free-tier/scale-to-zero; billing alarm before first deploy.
- Don't use the bare "BMG" acronym in outward-facing copy — spell out Blue Milk Gaming.
