// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "blue-milk-gaming",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
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

    new sst.aws.Nextjs("Web", {
      link: [player, tournament, placement, account,
             pod, pointsLedger, playerBalance, podsWebhookUrl,
             discordClientId, discordClientSecret, authSecret, adminDiscordIds],
    });

    // Weekly results sync. Monday 14:00 UTC is the morning after Sunday
    // night's Online Local with hours to spare, in either US daylight or
    // standard time. Melee has no webhooks and asks not to be polled, so once
    // a week is the whole strategy (ADR 0004).
    new sst.aws.Cron("MeleeSync", {
      schedule: "cron(0 14 ? * MON *)",
      function: {
        handler: "src/cron/sync-melee.handler",
        link: [player, tournament, placement, meleeClientId, meleeClientSecret],
        // A normal week imports one event in seconds. The headroom is for a
        // run that has several weeks to catch up, each paced by the delay
        // between melee requests.
        timeout: "5 minutes",
      },
    });
  },
});
