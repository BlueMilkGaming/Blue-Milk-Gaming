// Auth.js v5. JWT sessions, no adapter (ADR 0001): the session carries the
// Discord snowflake, which is the durable identity everything else keys on.
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { Resource } from "sst";
import { parseAdminIds } from "./admins.ts";

declare module "next-auth" {
  interface Session {
    user: { discordUserId: string; name: string; isAdmin: boolean };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: Resource.AuthSecret.value,
  trustHost: true, // behind CloudFront the Host header is not the Lambda's own
  providers: [
    Discord({
      clientId: Resource.DiscordClientId.value,
      clientSecret: Resource.DiscordClientSecret.value,
      // identify only: username + id. No email scope; we have no use for it.
      authorization: { params: { scope: "identify" } },
    }),
  ],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.discordUserId = String(profile.id);
        token.name = String(profile.global_name ?? profile.username);
      }
      return token;
    },
    session({ session, token }) {
      session.user = {
        discordUserId: token.discordUserId as string,
        name: token.name as string,
        isAdmin: parseAdminIds(Resource.AdminDiscordIds.value).has(
          token.discordUserId as string,
        ),
      } as typeof session.user;
      return session;
    },
  },
});
