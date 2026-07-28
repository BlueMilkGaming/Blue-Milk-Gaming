# ADR 0003: Domain layout and DNS

Date: 2026-07-28 · Status: Accepted · Supersedes the open question in [0002](0002-corrections.md)

## Context

`bluemilkgaming.com` is owned by Blue Milk Gaming with DNS hosted at Cloudflare. The apex currently serves the Fourthwall merch store, which was always meant to be a temporary use of the domain.

## Decision

The new site takes the apex. The store moves to a subdomain.

| Host | Serves |
|---|---|
| `bluemilkgaming.com` | The new site (CloudFront via SST) |
| `www.bluemilkgaming.com` | Redirect to apex |
| `shop.bluemilkgaming.com` | Fourthwall store |

DNS stays at Cloudflare. SST configures records through its Cloudflare adapter:

```ts
new sst.aws.Nextjs("Web", {
  domain: {
    name: "bluemilkgaming.com",
    redirects: ["www.bluemilkgaming.com"],
    dns: sst.cloudflare.dns(),
  },
});
```

This needs `CLOUDFLARE_API_TOKEN` (scoped to **Edit zone DNS**) and `CLOUDFLARE_DEFAULT_ACCOUNT_ID` in the deploy environment. SST requests the ACM certificate and writes the validation records into Cloudflare automatically.

## Cutover sequence

Order matters — the store should never be unreachable at a working URL.

1. Add the custom subdomain `shop.bluemilkgaming.com` in Fourthwall and point DNS at it. Verify the store loads there.
2. Deploy the new site to its CloudFront URL and verify it.
3. Only then repoint the apex from Fourthwall to CloudFront.
4. Update the YouTube, Discord, and Patreon profile links to the new apex; leave the store link pointing at `shop.`.

## Consequences

- Cloudflare records for the apex must be **DNS-only (grey cloud)**, not proxied. Cloudflare's orange-cloud proxy in front of CloudFront doubles up CDNs and breaks ACM's HTTP validation path; SST expects to own the TLS termination at CloudFront.
- Until step 3 runs, deploys are reachable only at the CloudFront URL, which is fine for development.
- Any existing SEO or inbound links to the apex will land on the new site rather than the store; the store's own links need updating at cutover.
