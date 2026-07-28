# ADR 0001: Website tech stack

Date: 2026-07-21 · Status: Accepted

## Context

Greenfield website for Blue Milk Gaming, a Star Wars: Unlimited content org, with mixed needs: static marketing pages, a dynamic sortable/searchable leaderboard auto-updated from melee.gg results, Discord-authenticated prize redemptions, and scheduled result syncing. Owner is a senior backend/cloud engineer; hosting on AWS is fixed; cost must stay at hobby-project levels (free tier / scale-to-zero).

## Decision

- **Next.js 15 (App Router, TypeScript, Tailwind)** — one framework for static + dynamic + authed pages + API routes.
- **SST v3** deploying via OpenNext (CloudFront + Lambda + S3) — TypeScript IaC in `website/sst.config.ts`, covers the app, DynamoDB, secrets, and EventBridge cron in one config. ~$0/mo at expected traffic.
- **DynamoDB** — always-free tier, scale-to-zero, transactions for redemption atomicity. *Provisional: table design deferred until reconciled with the owner's data-model draft (Phase 3 gate).*
- **Auth.js (NextAuth v5) + Discord provider**, JWT sessions; admin = Discord ID allowlist stamped as a role claim, enforced server-side.
- **Results importer** behind a `ResultsProvider` interface: CSV provider (Google Sheets export) from day one; melee.gg API provider added when org credentials are granted; shared idempotent ingest pipeline writing an append-only points ledger.

## Alternatives considered

- **Amplify Hosting**: less control, hides the cron/infra story; owner prefers real IaC.
- **Containers (App Runner/Fargate)**: never scales to zero; ongoing cost.
- **Aurora Serverless v2**: cost-surprise risk and resume latency vs. DynamoDB's free tier at tiny scale.

## Consequences

- OpenNext lags newest Next.js features occasionally → pin Next + OpenNext versions; avoid edge-runtime-only features; skip Lambda image optimization at this scale.
- Auth.js v5 API churn → pin version, isolate config in `website/src/lib/auth.ts`.
- melee.gg API is undocumented publicly → CSV import is the permanent fallback path; assume polling (EventBridge schedule), not webhooks.
