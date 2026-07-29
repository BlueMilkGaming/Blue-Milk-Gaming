/** Comma-separated Discord user IDs from the AdminDiscordIds secret. */
export function parseAdminIds(raw: string): Set<string> {
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}
