// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "blue-milk-gaming",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        cloudflare: { package: "@pulumi/cloudflare", version: "6.18.0" },
      },
    };
  },
  async run() {
    // Leaderboard storage (ADR 0004). Purpose-shaped tables, on-demand billing,
    // which is the SST default.
    //
    // Players are keyed on melee's account-level UserIdentity UUID. The integer
    // ID on a standings row is a per-tournament registration ID and changes
    // every event; usernames are changeable every 28 days. UserIdentity is the
    // only durable anchor melee exposes.
    const player = new sst.aws.Dynamo("Player", {
      fields: { meleeUserIdentity: "string" },
      primaryIndex: { hashKey: "meleeUserIdentity" },
    });
    const tournament = new sst.aws.Dynamo("Tournament", {
      fields: { meleeId: "number" },
      primaryIndex: { hashKey: "meleeId" },
    });
    const placement = new sst.aws.Dynamo("Placement", {
      fields: { meleeId: "number", meleeUserIdentity: "string" },
      primaryIndex: { hashKey: "meleeId", rangeKey: "meleeUserIdentity" },
    });
    // Discord-side identity (pods spec, Stage 1). Keyed on the snowflake; a
    // claim links it to a Player by setting meleeUserIdentity. Nothing re-keys.
    const account = new sst.aws.Dynamo("Account", {
      fields: { discordUserId: "string" },
      primaryIndex: { hashKey: "discordUserId" },
    });
    // Pods (pods spec, Stage 2). One pod = one item. byStatus finds the open
    // lobby and running pods; byDay feeds the best-2-pods-per-day settle-up.
    const pod = new sst.aws.Dynamo("Pod", {
      fields: { podId: "string", status: "string", day: "string" },
      primaryIndex: { hashKey: "podId" },
      globalIndexes: {
        byStatus: { hashKey: "status" },
        byDay: { hashKey: "day" },
      },
    });
    // Points (ADR 0004), first real consumers. Ledger entries for pods key on
    // the Discord snowflake; Sunday placements stay melee-keyed and join through
    // Account.meleeUserIdentity later.
    const pointsLedger = new sst.aws.Dynamo("PointsLedger", {
      fields: { playerId: "string", entryId: "string" },
      primaryIndex: { hashKey: "playerId", rangeKey: "entryId" },
    });
    const playerBalance = new sst.aws.Dynamo("PlayerBalance", {
      fields: { playerId: "string" },
      primaryIndex: { hashKey: "playerId" },
    });
    // Prize wall (redemption spec 2026-07-30). Prize rows hold only mutable
    // state (stock/hidden); the catalog itself lives in src/data/prize-wall.ts.
    // A stock attribute means finite stock; absent means unlimited.
    const prize = new sst.aws.Dynamo("Prize", {
      fields: { prizeId: "string" },
      primaryIndex: { hashKey: "prizeId" },
    });
    // One row per redemption request. Partition per player reads their
    // history in time order (ULID range key); the admin queue is a scan.
    const redemption = new sst.aws.Dynamo("Redemption", {
      fields: { playerId: "string", redemptionId: "string" },
      primaryIndex: { hashKey: "playerId", rangeKey: "redemptionId" },
    });
    // melee.gg API credentials. Set with:
    //   npx sst secret set MeleeClientId "..." --stage production
    const meleeClientId = new sst.Secret("MeleeClientId");
    const meleeClientSecret = new sst.Secret("MeleeClientSecret");
    // Discord OAuth + session signing (Stage 1 of the pods spec).
    const discordClientId = new sst.Secret("DiscordClientId");
    const discordClientSecret = new sst.Secret("DiscordClientSecret");
    const authSecret = new sst.Secret("AuthSecret");
    const adminDiscordIds = new sst.Secret("AdminDiscordIds");
    // Discord incoming webhook for pod announcements. No bot user.
    const podsWebhookUrl = new sst.Secret("PodsWebhookUrl");
    // Discord incoming webhook for the private admins channel: redemption pings.
    const adminWebhookUrl = new sst.Secret("AdminWebhookUrl");
    // Discord role ID for @LFG table pings on pod launch (Stage 2).
    const lfgRoleId = new sst.Secret("LfgRoleId");
    // ADR 0003: apex + www redirect, DNS at Cloudflare. Needs
    // CLOUDFLARE_API_TOKEN and CLOUDFLARE_DEFAULT_ACCOUNT_ID in website/.env
    // for every deploy. The store stays on merch. (managed by Fourthwall).
    new sst.aws.Nextjs("Web", {
      domain: {
        name: "bluemilkgaming.com",
        redirects: ["www.bluemilkgaming.com"],
        dns: sst.cloudflare.dns(),
      },
      link: [
        player,
        tournament,
        placement,
        account,
        pod,
        pointsLedger,
        playerBalance,
        prize,
        redemption,
        podsWebhookUrl,
        adminWebhookUrl,
        lfgRoleId,
        discordClientId,
        discordClientSecret,
        authSecret,
        adminDiscordIds,
      ],
    });
    // Weekly results sync. Monday 14:00 UTC is the morning after Sunday
    // night's Online Local with hours to spare, in either US daylight or
    // standard time. Melee has no webhooks and asks not to be polled, so once
    // a week is the whole strategy (ADR 0004).
    new sst.aws.Cron("MeleeSync", {
      schedule: "cron(0 12 ? * MON *)",
      function: {
        handler: "src/cron/sync-melee.handler",
        link: [player, tournament, placement, account, pointsLedger, playerBalance, meleeClientId, meleeClientSecret, adminWebhookUrl],
        // A normal week imports one event in seconds. The headroom is for a
        // run that has several weeks to catch up, each paced by the delay
        // between melee requests.
        timeout: "5 minutes",
      },
    });
  },
});
