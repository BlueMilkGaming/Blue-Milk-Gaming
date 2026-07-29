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

    new sst.aws.Nextjs("Web", { link: [player, tournament, placement] });

    // melee.gg API credentials. Set with:
    //   npx sst secret set MeleeClientId "..." --stage production
    const meleeClientId = new sst.Secret("MeleeClientId");
    const meleeClientSecret = new sst.Secret("MeleeClientSecret");

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
