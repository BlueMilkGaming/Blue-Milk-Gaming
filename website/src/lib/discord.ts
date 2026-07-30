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

/**
 * Post to the pods webhook and return the created message id, so the pod
 * can edit this one message for its whole lifetime. Best effort: any
 * failure returns null and the pod simply has no editable message.
 */
export async function announceWait(
  content: string,
  opts: { pingRoleId?: string } = {},
): Promise<string | null> {
  try {
    const body = opts.pingRoleId
      ? {
          content: `<@&${opts.pingRoleId}>\n${content}`,
          allowed_mentions: { roles: [opts.pingRoleId] },
        }
      : { content };
    const res = await fetch(`${Resource.PodsWebhookUrl.value}?wait=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

/** Edit the pod's message in place. Edits never re-ping mentions. */
export async function editAnnouncement(
  messageId: string | undefined,
  content: string,
): Promise<void> {
  if (!messageId) return;
  try {
    await fetch(`${Resource.PodsWebhookUrl.value}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallowed: a stale Discord card never blocks the write it follows.
  }
}
