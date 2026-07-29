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
  },
});
