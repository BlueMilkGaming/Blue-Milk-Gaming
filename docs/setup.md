# Setup — accounts, credentials, and secrets

Everything here is done once, outside the repo. **No real credential value belongs in a tracked file, ever.**

## Where secrets go

| Context | Mechanism | Notes |
|---|---|---|
| Local development | `website/.env.local` | Gitignored. Copy `website/.env.example` and fill in. |
| Deployed (AWS) | SST secrets | Encrypted in SSM Parameter Store; never in the repo. |

Setting a deployed secret:

```bash
npx sst secret set MeleeClientId "your-client-id" --stage production
```

List what's set (names and values — run it somewhere private):

```bash
npx sst secret list --stage production
```

Secrets are referenced in `sst.config.ts` via `new sst.Secret("MeleeClientId")` and linked to the functions that need them. A secret must be set for each stage you deploy.

## AWS access

**Do not use root credentials, and do not create root access keys.** Root is for account recovery, billing, and closing the account. Lock it down with MFA and a strong unique password, then never use it day to day.

Two workable options, in order of preference:

1. **IAM Identity Center (recommended).** Enable Identity Center in the account, create a permission set (`AdministratorAccess` is fine for a solo project), assign your user, then:
   ```bash
   aws configure sso
   ```
   Credentials are short-lived and refresh via browser login — nothing long-lived sits on disk. SST picks up the profile through `AWS_PROFILE`.

2. **IAM user with access keys.** Faster to set up, but the keys are long-lived credentials on your laptop. If you go this route, enable MFA on the user, scope it to what you need, and rotate the keys periodically.

Either way, verify before deploying:

```bash
aws sts get-caller-identity
```

### Billing alarm

Set this up **before** the first deploy. The stack should cost approximately nothing (CloudFront + Lambda + S3 + DynamoDB free tiers), so an alarm exists to catch mistakes, not normal usage. In the AWS console: Billing → Budgets → create a monthly cost budget (~$10) with an email alert at 80%.

## External accounts to register

| Service | What's needed | Blocks |
|---|---|---|
| melee.gg | Org API client ID + secret — request from contact@melee.gg | Phase 6 automated results sync |
| Discord | App at discord.com/developers; redirect URIs for `http://localhost:3000/api/auth/callback/discord` and the production URL; collect admin Discord user IDs | Phase 4 auth |
| YouTube | Channel ID (no API key — the content feed uses the public RSS endpoint) | Phase 2 content feed |
| Domain / DNS | See below | Public launch |

## Domain

`bluemilkgaming.com` currently serves the Fourthwall store, so the apex is taken. Decide before launch:

- **Option A:** new site takes the apex; store moves to `shop.bluemilkgaming.com` (Fourthwall supports a custom subdomain). Best long-term — the site becomes the front door.
- **Option B:** new site lives on a subdomain (`play.` or `tournaments.`) and the store keeps the apex. Lower risk, no store downtime, but splits the brand.

Until this is decided, deploys are reachable at the CloudFront URL SST prints — no DNS changes required.
