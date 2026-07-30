// Pod announcements via a Discord incoming webhook (no bot user).
import { Resource } from "sst";

export const SITE_URL = "https://bluemilkgaming.com";

/** Best effort by design: a lost Discord message never blocks a pod. */
export async function announce(content: string): Promise<void> {
  try {
    await fetch(Resource.PodsWebhookUrl.value, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallowed: announcing is never worth failing the pod write it follows.
  }
}
