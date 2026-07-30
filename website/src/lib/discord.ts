// Discord incoming webhooks (no bot user): pod announcements to the public
// channel, redemption pings to the private admins channel.
import { Resource } from "sst";

export const SITE_URL = "https://bluemilkgaming.com";

/** Best effort by design: a lost Discord message never blocks the write it follows. */
async function post(url: string, content: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallowed: announcing is never worth failing the write it follows.
  }
}

export async function announce(content: string): Promise<void> {
  return post(Resource.PodsWebhookUrl.value, content);
}

export async function announceAdmin(content: string): Promise<void> {
  return post(Resource.AdminWebhookUrl.value, content);
}
