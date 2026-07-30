# Setup — accounts, credentials, and secrets

Everything here is done once, outside the repo. **No real credential value belongs in a tracked file, ever.**

## Where secrets go

| Context | Mechanism | Notes |
|---|---|---|
| Local development | `website/.env.local` | Gitignored. Copy `website/.env.example` and fill in. |
| Deployed (AWS) | SST secrets | Encrypted in SSM Parameter Store; never in the repo. |

Setting a deployed secret — **run from `website/`**, since that's where `sst.config.ts` lives. Running it from the repo root fails with "Could not find sst.config.ts":

```bash
cd website && npx sst secret set MeleeClientId "your-client-id" --stage production
```

List what's set (names and values — run it somewhere private):

```bash
npx sst secret list --stage production
```

Secrets are referenced in `sst.config.ts` via `new sst.Secret("MeleeClientId")` and linked to the functions that need them. A secret must be set for each stage you deploy.

## AWS access

**Do not use root credentials, and do not create root access keys.** Root is for account recovery, billing, and closing the account. Lock it down with MFA and a strong unique password, then never use it day to day.

**Current setup: an IAM user (`BMGWebsiteAdmin`) with access keys, region `us-east-2`.**

IAM Identity Center was considered and rejected. It's built on AWS Organizations — enabling it in a standalone account silently creates an organization containing just that account. That works and costs nothing, but it stands up org-level machinery to manage one person, and the re-login flow adds friction with no real benefit at this size. It becomes worth revisiting if a second AWS account appears or someone else needs deploy access.

The trade-off accepted: an access key is a long-lived credential sitting on a laptop. The rules that keep that safe are:

- MFA enabled on the IAM user.
- The key never leaves the machine — not into the repo, not into a Dockerfile, not pasted into a chat or issue.
- If CI deploys are added later, use GitHub OIDC with an assumed role rather than putting the key in Actions secrets.
- Rotate periodically.

Verify before deploying:

```bash
aws sts get-caller-identity
```

## Discord app setup

Create a new application at **https://discord.com/developers/applications**:

1. Click "New Application" and give it a name (e.g., "Blue Milk Gaming").
2. In the OAuth2 section, get the **Client ID** and click "Reset Secret" to get the **Client Secret**.
3. Under Redirects, add two URIs:
   - Local: `http://localhost:3000/api/auth/callback/discord`
   - Production: `https://d3fdgelj2nhbqw.cloudfront.net/api/auth/callback/discord` (replace with the production domain once cutover happens)
4. Copy your User ID (visit the app page, yours shows in a tooltip). Collect any other admin Discord IDs.

### First deploy: the Pulumi provider download

SST deploys through Pulumi, which fetches a provider plugin binary on first use. The AWS one is ~176 MB, and SST's built-in retry gives up on a slow connection:

```
Could not automatically download and install resource plugin 'pulumi-resource-aws'
at version vX.Y.Z … failed all 5 attempts
```

This is a download timeout, not a credentials or permissions problem. Fetch it manually with a longer window and extract it into the plugin cache, then re-run the deploy:

```bash
curl -L -o /tmp/aws-plugin.tar.gz \
  https://github.com/pulumi/pulumi-aws/releases/download/vX.Y.Z/pulumi-resource-aws-vX.Y.Z-darwin-arm64.tar.gz
mkdir -p .sst/pulumi/plugins/resource-aws-vX.Y.Z
tar -xzf /tmp/aws-plugin.tar.gz -C .sst/pulumi/plugins/resource-aws-vX.Y.Z
```

If a deploy crashes partway it leaves a state lock, and the next run reports "A concurrent update was detected". Clear it with `npx sst unlock --stage production`.

### Billing alarm

Set this up **before** the first deploy. The stack should cost approximately nothing (CloudFront + Lambda + S3 + DynamoDB free tiers), so an alarm exists to catch mistakes, not normal usage. In the AWS console: Billing → Budgets → create a monthly cost budget (~$10) with an email alert at 80%.

## External accounts to register

| Service | What's needed | Blocks |
|---|---|---|
| melee.gg | Org API client ID + secret — request from contact@melee.gg | Phase 6 automated results sync |
| Discord | App setup (see above); set four secrets (below) | Stage 1: auth and admin queue |
| YouTube | Channel ID (no API key — the content feed uses the public RSS endpoint) | Phase 2 content feed |
| Domain / DNS | See below | Public launch |

### Discord secrets

After creating the Discord app above, set these four secrets:

```bash
cd website
npx sst secret set AuthSecret "<random-value>" --stage production
npx sst secret set DiscordClientId "<your-client-id>" --stage production
npx sst secret set DiscordClientSecret "<your-client-secret>" --stage production
npx sst secret set AdminDiscordIds "<your-id>,<other-admin-ids>" --stage production
```

Generate a random value for `AuthSecret` with: `openssl rand -base64 33`

These four live only as SST secrets. `src/lib/auth.ts` reads `Resource.*` directly, and `npm run dev` wraps `sst shell`, so local development picks them up from the deployed secrets automatically. There is nothing to add to `website/.env.local` for Discord auth.

## Domain

Decided in [ADR 0003](decisions/0003-domain.md): the new site takes `bluemilkgaming.com`; the Fourthwall store lives at `merch.bluemilkgaming.com` (moved 2026-07-30). DNS stays at Cloudflare.

Deploys that configure the domain need a Cloudflare API token with the **Edit zone DNS** policy plus the account ID. They live in `website/.env` (gitignored, auto-loaded by every `sst` command — `.env.local` is Next-only and `sst deploy` won't read it):

```
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_DEFAULT_ACCOUNT_ID=...
```

Keep the apex record **DNS-only (grey cloud)** — proxying Cloudflare in front of CloudFront breaks certificate validation. Until cutover, deploys are reachable at the CloudFront URL SST prints, so no DNS change is needed to start.
